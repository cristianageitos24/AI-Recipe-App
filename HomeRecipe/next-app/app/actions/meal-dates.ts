"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export async function getMealDates() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const { data: mealDates, error } = await supabase
    .from("meal_dates")
    .select(`
      id,
      event_id,
      date,
      meal_date_recipes (recipe_id, recipes (*))
    `)
    .eq("user_id", userId)
    .order("date");

  if (error) return { error: error.message, data: [] };

  const byDate: Record<string, { date: string; recipes: Array<{ eventID: string; [k: string]: unknown }> }> = {};
  for (const row of mealDates ?? []) {
    const date = row.date as string;
    const mdr = (row as { meal_date_recipes?: Array<{ recipe_id: string; recipes: unknown }> }).meal_date_recipes ?? [];
    const recipes = mdr.map((r: { recipe_id: string; recipes: unknown }) => ({
      ...(r.recipes as object),
      eventID: row.event_id,
    }));
    if (!byDate[date]) byDate[date] = { date, recipes };
    else byDate[date].recipes.push(...recipes);
  }
  const list = Object.values(byDate).map(({ date, recipes }) => ({ date, recipes }));
  return { error: null, data: list };
}

export async function createOrUpdateMealDate(params: {
  date: string;
  recipeID: string;
  eventID: string;
}) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("recipe_id", params.recipeID)
    .single();
  if (!recipe) return { error: "Recipe not found" };

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
    await supabase.from("meal_date_recipes").delete().eq("meal_date_id", existing.id);
    await supabase.from("meal_date_recipes").insert({ meal_date_id: existing.id, recipe_id: recipe.id });
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
    await supabase.from("meal_date_recipes").insert({ meal_date_id: inserted.id, recipe_id: recipe.id });
  }
  return { error: null };
}

export async function deleteMealDate(eventID: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

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
