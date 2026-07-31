"use server";

import { RECIPE_LIST_COLUMNS } from "@/lib/recipe-select";
import {
  MEAL_CALENDAR_LOOKAHEAD_MONTHS,
  MEAL_CALENDAR_RETENTION_DAYS,
} from "@/lib/meal-calendar-retention";
import { createClient } from "@/utils/supabase/server";
import { isUserPro, planLimitError } from "@/lib/entitlements";
import { requirePremiumPlanningAccess } from "@/lib/premium-access";

/** Bound calendar payload: retention lookback through lookahead months. */
function mealDateWindowIso(): { from: string; to: string } {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - MEAL_CALENDAR_RETENTION_DAYS);
  const to = new Date();
  to.setUTCMonth(to.getUTCMonth() + MEAL_CALENDAR_LOOKAHEAD_MONTHS);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function mealRecipeAllowed(
  recipe: {
    user_id?: string | null;
    expires_at?: string | null;
    deleted_at?: string | null;
  },
  userId: string,
  pro: boolean
): boolean {
  if (recipe.deleted_at != null) return false;
  if (pro) return true;
  if (recipe.user_id !== userId) return false;
  if (recipe.expires_at) {
    const exp = Date.parse(recipe.expires_at);
    if (Number.isFinite(exp) && exp < Date.now()) return false;
  }
  return true;
}

export async function getMealDates() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, data: [] };
  const { userId } = access;

  const supabase = await createClient();
  const pro = await isUserPro(userId);
  const { from, to } = mealDateWindowIso();
  const { data: mealDates, error } = await supabase
    .from("meal_dates")
    .select(`
      id,
      event_id,
      date,
      meal_date_recipes (recipe_id, recipes (${RECIPE_LIST_COLUMNS}))
    `)
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("date");

  if (error) return { error: error.message, data: [] };

  const byDate: Record<
    string,
    { date: string; recipes: Array<{ eventID: string; [k: string]: unknown }> }
  > = {};
  for (const row of mealDates ?? []) {
    const date = row.date as string;
    const rawMdr = (
      row as {
        meal_date_recipes?:
          | Array<{ recipe_id: string; recipes: unknown }>
          | { recipe_id: string; recipes: unknown }
          | null;
      }
    ).meal_date_recipes;
    const mdr = Array.isArray(rawMdr) ? rawMdr : rawMdr ? [rawMdr] : [];
    const recipes = mdr
      .map((r) => {
        const embedded =
          r.recipes && typeof r.recipes === "object"
            ? (r.recipes as Record<string, unknown>)
            : {};
        return {
          ...embedded,
          // meal_date_recipes.recipe_id is recipes.id (UUID); use as fallback.
          id: (embedded.id as string | undefined) ?? r.recipe_id,
          eventID: row.event_id,
        };
      })
      .filter((item) =>
        mealRecipeAllowed(
          item as {
            user_id?: string | null;
            expires_at?: string | null;
            deleted_at?: string | null;
          },
          userId,
          pro
        )
      );
    if (!byDate[date]) byDate[date] = { date, recipes };
    else byDate[date].recipes.push(...recipes);
  }
  const list = Object.values(byDate).map(({ date, recipes }) => ({
    date,
    recipes,
  }));
  return { error: null, data: list };
}

export async function createOrUpdateMealDate(params: {
  date: string;
  recipeID: string;
  eventID: string;
}) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const pro = await isUserPro(userId);

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, user_id, expires_at, deleted_at")
    .eq("recipe_id", params.recipeID)
    .is("deleted_at", null)
    .maybeSingle();
  if (!recipe) return { error: "Recipe not found" };

  if (!mealRecipeAllowed(recipe, userId, pro)) {
    const limit = planLimitError("catalog");
    return { error: limit.error, code: limit.code, reason: limit.reason };
  }

  const { data: existing } = await supabase
    .from("meal_dates")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", params.eventID)
    .single();

  if (existing) {
    await supabase
      .from("meal_dates")
      .update({ date: params.date })
      .eq("id", existing.id);
    await supabase
      .from("meal_date_recipes")
      .delete()
      .eq("meal_date_id", existing.id);
    await supabase
      .from("meal_date_recipes")
      .insert({ meal_date_id: existing.id, recipe_id: recipe.id });
  } else {
    const { data: inserted, error } = await supabase
      .from("meal_dates")
      .insert({
        user_id: userId,
        event_id: params.eventID,
        date: params.date,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await supabase
      .from("meal_date_recipes")
      .insert({ meal_date_id: inserted.id, recipe_id: recipe.id });
  }
  return { error: null };
}

export async function deleteMealDate(eventID: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("meal_dates")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventID)
    .single();
  if (!row) return { error: "Meal date not found" };

  await supabase.from("meal_date_recipes").delete().eq("meal_date_id", row.id);
  const { error } = await supabase.from("meal_dates").delete().eq("id", row.id);
  if (error) return { error: error.message };
  return { error: null };
}
