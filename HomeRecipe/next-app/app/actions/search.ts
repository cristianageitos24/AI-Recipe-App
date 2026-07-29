"use server";

import { getAuthUserId } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import {
  RECIPE_LIST_COLUMNS,
  RECIPE_TEASER_COLUMNS,
} from "@/lib/recipe-select";
import { isUserPro } from "@/lib/entitlements";
import type { RecipeRow } from "@/lib/types";

export type SearchSuggestions = {
  ingredients: string[];
  recipes: { recipe_id: string; recipe_label: string }[];
};

function notExpiredFilter() {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}

/** Ingredients-only suggestions: `fdc_foods.description` via service role (no client reads on bulk FDC). */
export async function getIngredientSuggestions(
  query: string
): Promise<{ error: string | null; data: string[] | null }> {
  const userId = await getAuthUserId();
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
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { error: null, data: { ingredients: [], recipes: [] } };
  }

  const supabase = await createClient();
  const pattern = `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const pro = await isUserPro(userId);

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

  let recipesQuery = supabase
    .from("recipes")
    .select("recipe_id, recipe_label")
    .is("deleted_at", null)
    .ilike("recipe_label", pattern)
    .limit(5);

  if (!pro) {
    recipesQuery = recipesQuery
      .eq("user_id", userId)
      .or(notExpiredFilter());
  }

  const recipesRes = await recipesQuery;
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
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = query.trim();
  if (!trimmed) {
    return { error: null, data: [] };
  }

  const supabase = await createClient();
  const pattern = `%${trimmed.replace(/%/g, "\\%")}%`;
  const pro = await isUserPro(userId);

  if (pro) {
    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_LIST_COLUMNS)
      .is("deleted_at", null)
      .ilike("recipe_label", pattern)
      .limit(50);

    if (error) return { error: error.message, data: null };
    return { error: null, data: (data ?? []) as unknown as RecipeRow[] };
  }

  // Free: own non-expired recipes (full list columns)
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS)
    .is("deleted_at", null)
    .eq("user_id", userId)
    .or(notExpiredFilter())
    .ilike("recipe_label", pattern)
    .limit(50);

  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? []) as unknown as RecipeRow[] };
}

export async function searchByIngredients(
  ingredients: string[]
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized", data: null };

  const trimmed = ingredients.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { error: null, data: [] };
  }

  const supabase = await createClient();
  const pro = await isUserPro(userId);

  let query = supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS)
    .is("deleted_at", null);

  if (!pro) {
    query = query.eq("user_id", userId).or(notExpiredFilter());
  }

  for (const ing of trimmed) {
    const pattern = `%${ing.replace(/%/g, "\\%")}%`;
    query = query.ilike("ingredient_lines", pattern);
  }

  const { data, error } = await query.limit(50);

  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? []) as unknown as RecipeRow[] };
}

/**
 * Home suggestions. Pro: full list columns. Free: shared catalog teasers only
 * (blur wall — no ingredients/steps/nutrition).
 */
export async function getSuggestedRecipes(
  excludeRecipeIds: string[] = []
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const pro = await isUserPro(userId);
  const excluded = new Set(excludeRecipeIds);
  const fetchLimit = Math.min(100, 12 + excluded.size * 2);

  if (pro) {
    const { data: rows, error: tableError } = await supabase
      .from("recipes")
      .select(RECIPE_LIST_COLUMNS)
      .is("deleted_at", null)
      .limit(fetchLimit);

    if (tableError) return { error: tableError.message, data: null };

    const list = (rows ?? []) as unknown as RecipeRow[];
    const filtered = list.filter((r) => !excluded.has(r.recipe_id));
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 12);
    return { error: null, data: shuffled };
  }

  const { data: rows, error: tableError } = await supabase
    .from("recipes")
    .select(RECIPE_TEASER_COLUMNS)
    .is("deleted_at", null)
    .is("user_id", null)
    .limit(fetchLimit);

  if (tableError) return { error: tableError.message, data: null };

  const list = (rows ?? []) as unknown as RecipeRow[];
  const filtered = list.filter((r) => !excluded.has(r.recipe_id));
  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 12);
  return { error: null, data: shuffled };
}
