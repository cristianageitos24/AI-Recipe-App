"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import type { RecipeRow } from "@/lib/types";

/** Narrow columns for list views (cards); avoids transferring ingredient_lines, steps */
const RECIPE_LIST_COLUMNS =
  "id, recipe_id, recipe_label, calories, cuisine_type, meal_type, time_in_minutes, image_url, website_url" as const;

export type SearchSuggestions = {
  ingredients: string[];
  recipes: { recipe_id: string; recipe_label: string }[];
};

/** Ingredients-only suggestions (one DB call); min length 1 when ingredientsOnly. */
export async function getIngredientSuggestions(
  query: string
): Promise<{ error: string | null; data: string[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed) {
    return { error: null, data: [] };
  }

  const supabase = await createClient();
  const pattern = `%${trimmed.replace(/%/g, "\\%")}%`;

  const { data, error } = await supabase
    .from("ingredients")
    .select("name")
    .ilike("search_name", pattern)
    .order("use_count", { ascending: false })
    .limit(10);

  if (error) return { error: error.message, data: null };
  const ingredients =
    data?.map((r) => r.name as string).filter(Boolean) ?? [];
  return { error: null, data: ingredients };
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
  const pattern = `%${trimmed.replace(/%/g, "\\%")}%`;

  const [ingredientsRes, recipesRes] = await Promise.all([
    supabase
      .from("ingredients")
      .select("name")
      .ilike("search_name", pattern)
      .order("use_count", { ascending: false })
      .limit(10),
    supabase
      .from("recipes")
      .select("recipe_id, recipe_label")
      .ilike("recipe_label", pattern)
      .limit(5),
  ]);

  const ingredients =
    ingredientsRes.data?.map((r) => r.name as string).filter(Boolean) ?? [];
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

  let query = supabase.from("recipes").select(RECIPE_LIST_COLUMNS);

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
    const filtered = rows.filter((r) => !excluded.has(r.recipe_id));
    return { error: null, data: filtered.slice(0, 12) };
  }

  const excluded = new Set(excludeRecipeIds);
  const fetchLimit = Math.min(100, 12 + excluded.size * 2);
  const { data: rows, error: tableError } = await supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS)
    .limit(fetchLimit);

  if (tableError) return { error: tableError.message, data: null };

  const list = (rows ?? []) as RecipeRow[];
  const filtered = list.filter((r) => !excluded.has(r.recipe_id));
  const shuffled = filtered
    .sort(() => Math.random() - 0.5)
    .slice(0, 12);

  return { error: null, data: shuffled };
}
