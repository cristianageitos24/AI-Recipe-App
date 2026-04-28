"use server";

import { auth } from "@clerk/nextjs/server";
import {
  syncRecipeNutritionForRecipe,
  type SyncRecipeNutritionOptions,
} from "@/lib/nutrition/sync-recipe-nutrition";
import { RECIPE_WITH_NUTRITION } from "@/lib/recipe-select";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import type { RecipePayload, RecipeRow } from "@/lib/types";

const MANUAL_RECIPE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function slugifyForPath(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeImageExtension(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const mapped = byType[file.type];
  if (mapped) return mapped;
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "jpg";
}
async function syncNutritionIfOwner(
  recipeUuid: string,
  userId: string,
  options?: SyncRecipeNutritionOptions
) {
  try {
    const svc = await createServiceRoleClient();
    const { data: row } = await svc
      .from("recipes")
      .select("user_id")
      .eq("id", recipeUuid)
      .maybeSingle();
    if (!row || row.user_id !== userId) return;
    await syncRecipeNutritionForRecipe(svc, recipeUuid, options);
  } catch (e) {
    console.error("syncNutritionIfOwner:", e);
  }
}

/**
 * User-selected USDA food for an ambiguous ingredient line. Re-runs nutrition sync with that `fdc_id`.
 */
export async function pickRecipeIngredientFdc(input: {
  recipeId: string;
  lineIndex: number;
  fdcId: number;
}): Promise<{ error: string | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, user_id")
    .eq("id", input.recipeId)
    .maybeSingle();

  if (error || !recipe) return { error: error?.message ?? "Recipe not found" };
  if (recipe.user_id !== userId) return { error: "Forbidden" };

  try {
    const svc = await createServiceRoleClient();
    const res = await syncRecipeNutritionForRecipe(svc, recipe.id, {
      lineFdcOverrides: { [input.lineIndex]: input.fdcId },
    });
    if (!res.ok) return { error: res.error };
    return { error: null };
  } catch (e) {
    console.error("pickRecipeIngredientFdc", e);
    return { error: "Failed to update nutrition" };
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

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_NUTRITION)
    .eq("id", res.data.id)
    .single();

  if (error) return { error: error.message, data: null };
  return { error: null, data: row as RecipeRow };
}

export async function uploadManualRecipeImage(formData: FormData): Promise<{
  error: string | null;
  url: string | null;
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", url: null };

  const file = formData.get("image");
  const recipeLabelRaw = formData.get("recipeLabel");
  if (!(file instanceof File)) {
    return { error: "Please select an image file.", url: null };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Only image files are supported.", url: null };
  }
  if (file.size > MANUAL_RECIPE_IMAGE_MAX_BYTES) {
    return { error: "Image must be 8MB or smaller.", url: null };
  }

  const recipeLabel =
    typeof recipeLabelRaw === "string" ? recipeLabelRaw : "recipe";
  const labelSlug = slugifyForPath(recipeLabel) || "recipe";
  const ext = normalizeImageExtension(file);
  const timestamp = Date.now();
  const storagePath = `users/${userId}/manual/${timestamp}-${labelSlug}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("recipe-covers")
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  const { data } = supabase.storage.from("recipe-covers").getPublicUrl(storagePath);
  if (!data.publicUrl) {
    return { error: "Failed to generate image URL.", url: null };
  }
  return { error: null, url: data.publicUrl };
}
