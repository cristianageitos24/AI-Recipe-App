"use server";

import { auth } from "@clerk/nextjs/server";
import { syncRecipeNutritionForRecipe } from "@/lib/nutrition/sync-recipe-nutrition";
import { RECIPE_WITH_NUTRITION } from "@/lib/recipe-select";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import type { RecipePayload, RecipeRow } from "@/lib/types";
import { upsertIngredientsFromRecipe } from "@/app/actions/ingredients";

async function syncNutritionIfOwner(recipeUuid: string, userId: string) {
  try {
    const svc = await createServiceRoleClient();
    const { data: row } = await svc
      .from("recipes")
      .select("user_id")
      .eq("id", recipeUuid)
      .maybeSingle();
    if (!row || row.user_id !== userId) return;
    await syncRecipeNutritionForRecipe(svc, recipeUuid);
  } catch (e) {
    console.error("syncNutritionIfOwner:", e);
  }
}

/**
 * Fetch a single recipe by its UUID primary key with full columns (ingredient_lines, steps).
 * Use when opening a recipe card that was loaded from a narrow list (e.g. search results).
 */
export async function getRecipeFull(
  recipeId: string
): Promise<{ error: string | null; data: RecipeRow | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_NUTRITION)
    .eq("id", recipeId)
    .single();

  if (error) return { error: error.message, data: null };
  return { error: null, data: data as RecipeRow };
}

export async function getOrCreateRecipe(payload: RecipePayload) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();

  const isUserOwned =
    payload.recipeID.startsWith("manual-") ||
    payload.recipeID.startsWith("video-recipe-") ||
    payload.recipeID.startsWith("url-import-");

  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("recipe_id", payload.recipeID)
    .single();

  if (existing) {
    if (isUserOwned) {
      await supabase
        .from("recipes")
        .update({
          recipe_label: payload.recipe_label,
          calories: payload.calories,
          cuisine_type: payload.cuisine_type,
          meal_type: payload.meal_type,
          time_in_minutes: payload.time_in_minutes,
          ingredient_lines: payload.ingredient_lines,
          steps: payload.steps ?? null,
          website_url: payload.website_url,
          image_url: payload.image_url,
        })
        .eq("id", existing.id);
      await syncNutritionIfOwner(existing.id, userId);
    }
    return { error: null, data: existing };
  }

  const user_id = isUserOwned ? userId : null;

  const { data: inserted, error } = await supabase
    .from("recipes")
    .insert({
      recipe_id: payload.recipeID,
      recipe_label: payload.recipe_label,
      calories: payload.calories,
      cuisine_type: payload.cuisine_type,
      meal_type: payload.meal_type,
      time_in_minutes: payload.time_in_minutes,
      ingredient_lines: payload.ingredient_lines,
      steps: payload.steps ?? null,
      website_url: payload.website_url,
      image_url: payload.image_url,
      user_id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, data: null };
  if (isUserOwned) {
    await syncNutritionIfOwner(inserted.id, userId);
  }
  return { error: null, data: inserted };
}

/**
 * Create (or update) a recipe from a payload and return the full recipe row.
 * Used by the create-recipe page so we can show RecipeFullView and SaveToFolderButton.
 */
export async function createRecipeAndReturn(
  payload: RecipePayload
): Promise<{ error: string | null; data: RecipeRow | null }> {
  const res = await getOrCreateRecipe(payload);
  if (res.error || !res.data) return { error: res.error ?? "Failed to get/create recipe", data: null };

  if (payload.ingredient_lines) {
    await upsertIngredientsFromRecipe(payload.ingredient_lines);
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_NUTRITION)
    .eq("id", res.data.id)
    .single();

  if (error) return { error: error.message, data: null };
  return { error: null, data: row as RecipeRow };
}
