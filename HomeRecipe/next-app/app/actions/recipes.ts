"use server";

import { auth } from "@clerk/nextjs/server";
import {
  syncRecipeNutritionForRecipe,
  type SyncRecipeNutritionOptions,
} from "@/lib/nutrition/sync-recipe-nutrition";
import { RECIPE_WITH_NUTRITION } from "@/lib/recipe-select";
import { trashListCutoffIso } from "@/lib/trash-retention";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import type { TrashActionResult } from "@/lib/trash-result";
import type { RecipePayload, RecipeRow } from "@/lib/types";
import { compressImageLossless } from "@/lib/compress-image";
import {
  assertCanOpenRecipe,
  freeRecipeExpiresAtIso,
  isUserPro,
  restoreGraceExpiresAtIso,
} from "@/lib/entitlements";

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
): Promise<{
  error: string | null;
  data: RecipeRow | null;
  code?: string;
  reason?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_WITH_NUTRITION)
    .eq("id", recipeId)
    .is("deleted_at", null)
    .single();

  if (error) return { error: error.message, data: null };
  if (!data) return { error: "Recipe not found", data: null };

  const row = data as RecipeRow;
  const access = await assertCanOpenRecipe(userId, {
    user_id: row.user_id,
    expires_at: row.expires_at,
    deleted_at: row.deleted_at,
  });

  if (!access.ok) {
    if ("forbidden" in access && access.forbidden) {
      return { error: "Forbidden", data: null };
    }
    if ("limit" in access && access.limit) {
      return {
        error: access.limit.error,
        data: null,
        code: access.limit.code,
        reason: access.limit.reason,
      };
    }
    return { error: "Forbidden", data: null };
  }

  return { error: null, data: row };
}

export async function softDeleteOwnedRecipe(recipeId: string): Promise<TrashActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, reason: "forbidden" };
  if (!data) {
    const { data: row } = await supabase
      .from("recipes")
      .select("id, user_id, deleted_at")
      .eq("id", recipeId)
      .maybeSingle();
    if (!row) return { ok: false, reason: "not_found" };
    if (row.user_id !== userId) return { ok: false, reason: "forbidden" };
    if (row.deleted_at) return { ok: false, reason: "already_trashed" };
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, state: "trashed", recipeId: data.id };
}

export async function restoreOwnedRecipe(recipeId: string): Promise<TrashActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("recipes")
    .select("id, deleted_at, user_id, expires_at")
    .eq("id", recipeId)
    .maybeSingle();

  if (fetchErr) return { ok: false, reason: "forbidden" };
  if (!existing) return { ok: false, reason: "not_restorable" };
  if (existing.user_id !== userId) return { ok: false, reason: "forbidden" };
  if (existing.deleted_at === null) return { ok: false, reason: "already_active" };

  const pro = await isUserPro(userId);
  let nextExpiresAt: string | null = null;
  if (pro) {
    nextExpiresAt = null;
  } else {
    const existingExp = existing.expires_at
      ? Date.parse(existing.expires_at)
      : NaN;
    if (Number.isFinite(existingExp) && existingExp > Date.now()) {
      nextExpiresAt = existing.expires_at as string;
    } else {
      nextExpiresAt = restoreGraceExpiresAtIso();
    }
  }

  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: null, expires_at: nextExpiresAt })
    .eq("id", recipeId)
    .eq("user_id", userId);

  if (error) return { ok: false, reason: "not_restorable" };
  return { ok: true, state: "restored", recipeId };
}

export type TrashedRecipeRow = {
  id: string;
  recipe_label: string;
  deleted_at: string;
};

/** User-owned soft-deleted recipes still within the retention window (see `purge_trashed_rows`). */
export async function getTrashedRecipes(): Promise<{
  error: string | null;
  data: TrashedRecipeRow[];
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const cutoff = trashListCutoffIso();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, recipe_label, deleted_at")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff)
    .order("deleted_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { error: null, data: (data ?? []) as TrashedRecipeRow[] };
}

export async function getOrCreateRecipe(payload: RecipePayload) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const isUserOwned =
    payload.recipeID.startsWith("manual-") ||
    payload.recipeID.startsWith("video-recipe-") ||
    payload.recipeID.startsWith("url-import-");

  // Use service role so writes succeed even when Clerk→Supabase JWT / RLS `auth.jwt()->>'sub'`
  // is not configured; ownership is enforced via Clerk `userId` and `user_id` on rows.
  const svc = await createServiceRoleClient();

  const { data: existing } = await svc
    .from("recipes")
    .select("id, user_id")
    .eq("recipe_id", payload.recipeID)
    .maybeSingle();

  if (existing) {
    if (isUserOwned) {
      if (existing.user_id !== userId) {
        return { error: "Forbidden", data: null };
      }
      const { error: updError } = await svc
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
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (updError) return { error: updError.message, data: null };
      await syncNutritionIfOwner(existing.id, userId);
    }
    return { error: null, data: { id: existing.id } };
  }

  const user_id = isUserOwned ? userId : null;
  const pro = isUserOwned ? await isUserPro(userId) : true;
  const expires_at =
    isUserOwned && !pro ? freeRecipeExpiresAtIso() : null;

  const { data: inserted, error } = await svc
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
      expires_at,
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
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const res = await getOrCreateRecipe(payload);
  if (res.error || !res.data) return { error: res.error ?? "Failed to get/create recipe", data: null };

  const isUserOwned =
    payload.recipeID.startsWith("manual-") ||
    payload.recipeID.startsWith("video-recipe-") ||
    payload.recipeID.startsWith("url-import-");

  const svc = await createServiceRoleClient();
  const { data: row, error } = await svc
    .from("recipes")
    .select(RECIPE_WITH_NUTRITION)
    .eq("id", res.data.id)
    .single();

  if (error) return { error: error.message, data: null };
  if (!row) return { error: "Recipe not found", data: null };

  if (isUserOwned && row.user_id !== userId) {
    return { error: "Forbidden", data: null };
  }

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

  const svc = await createServiceRoleClient();
  const compressed = await compressImageLossless(
    Buffer.from(await file.arrayBuffer()),
    file.type || "image/png"
  );
  const { error: uploadError } = await svc.storage
    .from("recipe-covers")
    .upload(storagePath, compressed.buffer, {
      contentType: compressed.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  const { data } = svc.storage.from("recipe-covers").getPublicUrl(storagePath);
  if (!data.publicUrl) {
    return { error: "Failed to generate image URL.", url: null };
  }
  return { error: null, url: data.publicUrl };
}
