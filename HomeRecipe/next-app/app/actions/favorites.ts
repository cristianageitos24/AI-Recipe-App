"use server";

import { getAuthUserId } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { RECIPE_LIST_COLUMNS } from "@/lib/recipe-select";
import type { RecipePayload, RecipeRow } from "@/lib/types";
import { isUserPro, planLimitError } from "@/lib/entitlements";

function isOwnNonExpired(
  recipe: { user_id?: string | null; expires_at?: string | null; deleted_at?: string | null },
  userId: string
): boolean {
  if (recipe.deleted_at != null) return false;
  if (recipe.user_id !== userId) return false;
  if (recipe.expires_at) {
    const exp = Date.parse(recipe.expires_at);
    if (Number.isFinite(exp) && exp < Date.now()) return false;
  }
  return true;
}

export async function getFavorites() {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const pro = await isUserPro(userId);
  const { data, error } = await supabase
    .from("favorites")
    .select(`
      recipe_id,
      recipes (${RECIPE_LIST_COLUMNS})
    `)
    .eq("user_id", userId);

  if (error) return { error: error.message, data: [] };
  const recipes = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes)
    .filter((r): r is RecipeRow => {
      if (r == null) return false;
      const row = r as RecipeRow;
      if (row.deleted_at != null) return false;
      if (pro) return true;
      return isOwnNonExpired(row, userId);
    });
  return { error: null, data: recipes };
}

export async function addFavorite(payload: RecipePayload) {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized" };

  const isUserOwned =
    payload.recipeID.startsWith("manual-") ||
    payload.recipeID.startsWith("video-recipe-") ||
    payload.recipeID.startsWith("url-import-");

  if (!isUserOwned && !(await isUserPro(userId))) {
    const limit = planLimitError("catalog");
    return { error: limit.error, code: limit.code, reason: limit.reason };
  }

  const supabase = await createClient();

  const { getOrCreateRecipe } = await import("@/app/actions/recipes");
  const result = await getOrCreateRecipe(payload);
  if (result.error || !result.data) return { error: result.error ?? "Failed to get/create recipe" };

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, recipe_id: result.data.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: null };
    return { error: error.message };
  }
  return { error: null };
}

export async function removeFavorite(recipeId: string) {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("recipe_id", recipeId)
    .single();
  if (!recipe) return { error: "Recipe not found" };

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipe.id);

  if (error) return { error: error.message };
  return { error: null };
}
