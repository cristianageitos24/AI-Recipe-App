"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import type { RecipeRow } from "@/lib/types";

/** Narrow columns for list views (cards); avoids transferring ingredient_lines, steps */
const RECIPE_LIST_COLUMNS =
  "id, recipe_id, recipe_label, calories, cuisine_type, meal_type, time_in_minutes, image_url, website_url, recipe_nutrition(energy_kcal, nutrition_source)" as const;

export type SearchSuggestions = {
  ingredients: string[];
  recipes: { recipe_id: string; recipe_label: string }[];
};

/** Ingredients-only suggestions: `fdc_foods.description` via service role (no client reads on bulk FDC). */
export async function getIngredientSuggestions(
  query: string
): Promise<{ error: string | null; data: string[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed) {
    return { error: null, data: [] };
  }

  try {
    const svc = await createServiceRoleClient();
    const pattern = `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const { data, error } = await svc
      .from("fdc_foods")
      .select("description")
      .ilike("description", pattern)
      .order("description", { ascending: true })
      .limit(12);

    if (error) return { error: error.message, data: null };
    const seen = new Set<string>();
    const ingredients: string[] = [];
    for (const row of data ?? []) {
      const name = (row as { description?: string }).description?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      ingredients.push(name);
      if (ingredients.length >= 10) break;
    }
    return { error: null, data: ingredients };
  } catch (e) {
    console.error("getIngredientSuggestions", e);
    return { error: "Search unavailable", data: null };
  }
}

export async function getSearchSuggestions(
  query: string
): Promise<{ error: string | null; data: SearchSuggestions | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { error: null, data: { ingredients: [], recipes: [] } };
  }

  const supabase = await createClient();
  const pattern = `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  let ingredients: string[] = [];
  try {
    const svc = await createServiceRoleClient();
    const { data: fdcRows, error: fdcErr } = await svc
      .from("fdc_foods")
      .select("description")
      .ilike("description", pattern)
      .order("description", { ascending: true })
      .limit(12);
    if (!fdcErr && fdcRows) {
      const seen = new Set<string>();
      for (const row of fdcRows) {
        const name = (row as { description?: string }).description?.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        ingredients.push(name);
        if (ingredients.length >= 10) break;
      }
    }
  } catch {
    ingredients = [];
  }

  const recipesRes = await supabase
    .from("recipes")
    .select("recipe_id, recipe_label")
    .is("deleted_at", null)
    .ilike("recipe_label", pattern)
    .limit(5);
  const recipes =
    recipesRes.data?.map((r) => ({
      recipe_id: r.recipe_id as string,
      recipe_label: r.recipe_label as string,
    })) ?? [];

  return {
    error: null,
    data: { ingredients, recipes },
  };
}

export async function searchRecipes(
  query: string
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed) {
    return { error: null, data: [] };
  }

  const supabase = await createClient();
  const pattern = `%${trimmed.replace(/%/g, "\\%")}%`;

  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS)
    .is("deleted_at", null)
    .ilike("recipe_label", pattern)
    .limit(50);

  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? []) as RecipeRow[] };
}

export async function searchByIngredients(
  ingredients: string[]
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = ingredients.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { error: null, data: [] };
  }

  const supabase = await createClient();

  let query = supabase.from("recipes").select(RECIPE_LIST_COLUMNS).is("deleted_at", null);

  for (const ing of trimmed) {
    const pattern = `%${ing.replace(/%/g, "\\%")}%`;
    query = query.ilike("ingredient_lines", pattern);
  }

  const { data, error } = await query.limit(50);

  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? []) as RecipeRow[] };
}

export async function getSuggestedRecipes(
  excludeRecipeIds: string[] = []
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const limit = Math.min(24, 12 + excludeRecipeIds.length);
  const { data, error } = await supabase.rpc("get_random_recipes", {
    p_limit: limit,
  });

  if (!error) {
    const rows = (data ?? []) as RecipeRow[];
    const excluded = new Set(excludeRecipeIds);
    const filtered = rows.filter(
      (r) =>
        !excluded.has(r.recipe_id) &&
        (r as { deleted_at?: string | null }).deleted_at == null
    );
    return { error: null, data: filtered.slice(0, 12) };
  }

  const excluded = new Set(excludeRecipeIds);
  const fetchLimit = Math.min(100, 12 + excluded.size * 2);
  const { data: rows, error: tableError } = await supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS)
    .is("deleted_at", null)
    .limit(fetchLimit);

  if (tableError) return { error: tableError.message, data: null };

  const list = (rows ?? []) as RecipeRow[];
  const filtered = list.filter((r) => !excluded.has(r.recipe_id));
  const shuffled = filtered
    .sort(() => Math.random() - 0.5)
    .slice(0, 12);

  return { error: null, data: shuffled };
}
