"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { RECIPE_LIST_COLUMNS } from "@/lib/recipe-select";
import type { RecipePayload } from "@/lib/types";

export async function getFavorites() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
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
    .filter((r): r is Record<string, unknown> => {
      if (r == null) return false;
      const row = r as { deleted_at?: string | null };
      return row.deleted_at == null;
    });
  return { error: null, data: recipes as import("@/lib/types").RecipeRow[] };
}

export async function addFavorite(payload: RecipePayload) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

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
    if (error.code === "23505") return { error: null }; // already favorited
    return { error: error.message };
  }
  return { error: null };
}

export async function removeFavorite(recipeId: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();

  // recipeId from frontend is the string recipe_id; we need recipes.id (uuid)
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
