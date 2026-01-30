"use server";

import { createClient } from "@/utils/supabase/server";
import type { RecipePayload } from "@/lib/types";

export async function getFavorites() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", data: [] };

  const { data, error } = await supabase
    .from("favorites")
    .select(`
      recipe_id,
      recipes (*)
    `)
    .eq("user_id", user.id);

  if (error) return { error: error.message, data: [] };
  const recipes = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes)
    .filter((r): r is Record<string, unknown> => r != null);
  return { error: null, data: recipes as import("@/lib/types").RecipeRow[] };
}

export async function addFavorite(payload: RecipePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { getOrCreateRecipe } = await import("@/app/actions/recipes");
  const result = await getOrCreateRecipe(payload);
  if (result.error || !result.data) return { error: result.error ?? "Failed to get/create recipe" };

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, recipe_id: result.data.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: null }; // already favorited
    return { error: error.message };
  }
  return { error: null };
}

export async function removeFavorite(recipeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

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
    .eq("user_id", user.id)
    .eq("recipe_id", recipe.id);

  if (error) return { error: error.message };
  return { error: null };
}
