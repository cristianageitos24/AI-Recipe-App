"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { trashListCutoffIso } from "@/lib/trash-retention";
import type { TrashActionResult } from "@/lib/trash-result";
import { RECIPE_WITH_NUTRITION } from "@/lib/recipe-select";
import type { RecipePayload } from "@/lib/types";

const COOKBOOK_COVER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

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

export type GetFoldersData = {
  folders: string[];
  folderIdsByName: Record<string, string>;
  results: Record<string, unknown[]>;
  folderCovers: Record<string, string | null>;
};

function emptyFoldersData(): GetFoldersData {
  return { folders: [], folderIdsByName: {}, results: {}, folderCovers: {} };
}

function recipeRowNotTrashed(r: Record<string, unknown>): boolean {
  return r.deleted_at == null || r.deleted_at === undefined;
}

export async function getFolders() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: emptyFoldersData() };

  const supabase = await createClient();
  const { data: foldersData, error: foldersError } = await supabase
    .from("folders")
    .select("id, folder_name, cover_image_url")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("folder_name");

  if (foldersError) return { error: foldersError.message, data: emptyFoldersData() };

  const folders = foldersData ?? [];
  if (folders.length === 0) {
    return {
      error: null,
      data: emptyFoldersData(),
    };
  }

  const folderCovers: Record<string, string | null> = {};
  const folderIdsByName: Record<string, string> = {};
  for (const f of folders as { id: string; folder_name: string; cover_image_url: string | null }[]) {
    folderCovers[f.folder_name] = f.cover_image_url ?? null;
    folderIdsByName[f.folder_name] = f.id;
  }

  const folderIds = folders.map((f: { id: string }) => f.id);
  const { data: folderRecipesRows, error: frError } = await supabase
    .from("folder_recipes")
    .select(`folder_id, recipes (${RECIPE_WITH_NUTRITION})`)
    .in("folder_id", folderIds);

  if (frError) {
    console.error("getFolders: folder_recipes/recipes join failed:", frError.message);
  }

  const idToName = new Map(folders.map((f: { id: string; folder_name: string }) => [f.id, f.folder_name]));
  const results: Record<string, unknown[]> = {};
  for (const name of idToName.values()) results[name as string] = [];

  if (!frError) {
    for (const row of folderRecipesRows ?? []) {
      const r = row as unknown as { folder_id: string; recipes: Record<string, unknown> | null };
      const name = idToName.get(r.folder_id);
      if (name != null && r.recipes != null && recipeRowNotTrashed(r.recipes)) {
        results[name].push(r.recipes);
      }
    }
  }

  return {
    error: null,
    data: {
      folders: folders.map((f: { folder_name: string }) => f.folder_name),
      folderIdsByName,
      folderCovers,
      results,
    },
  };
}

export async function uploadCookbookCoverImage(formData: FormData): Promise<{
  error: string | null;
  url: string | null;
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", url: null };

  const file = formData.get("image");
  const folderIdRaw = formData.get("folderId");
  const folderNameRaw = formData.get("folderName");
  if (!(file instanceof File)) {
    return { error: "Please select an image file.", url: null };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Only image files are supported.", url: null };
  }
  if (file.size > COOKBOOK_COVER_IMAGE_MAX_BYTES) {
    return { error: "Image must be 8MB or smaller.", url: null };
  }

  const labelSlug =
    typeof folderNameRaw === "string" && folderNameRaw.trim()
      ? slugifyForPath(folderNameRaw.trim())
      : "cookbook";
  const ext = normalizeImageExtension(file);
  const storagePath = `users/${userId}/cookbook-covers/${Date.now()}-${labelSlug}.${ext}`;

  const svc = await createServiceRoleClient();
  const { error: uploadError } = await svc.storage.from("recipe-covers").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  const { data: urlData } = svc.storage.from("recipe-covers").getPublicUrl(storagePath);
  if (!urlData.publicUrl) {
    return { error: "Failed to generate image URL.", url: null };
  }

  const supabase = await createClient();
  let updateError = null as string | null;

  if (typeof folderIdRaw === "string" && folderIdRaw.trim()) {
    const { error } = await supabase
      .from("folders")
      .update({ cover_image_url: urlData.publicUrl })
      .eq("user_id", userId)
      .eq("id", folderIdRaw.trim())
      .is("deleted_at", null);
    updateError = error?.message ?? null;
  } else if (typeof folderNameRaw === "string" && folderNameRaw.trim()) {
    const { error } = await supabase
      .from("folders")
      .update({ cover_image_url: urlData.publicUrl })
      .eq("user_id", userId)
      .eq("folder_name", folderNameRaw.trim())
      .is("deleted_at", null);
    updateError = error?.message ?? null;
  } else {
    return { error: "Missing cookbook identifier.", url: null };
  }

  if (updateError) {
    return { error: updateError, url: null };
  }
  return { error: null, url: urlData.publicUrl };
}

export async function clearCookbookCoverImage(folderId: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ cover_image_url: null })
    .eq("user_id", userId)
    .eq("id", folderId)
    .is("deleted_at", null);

  if (error) return { error: error.message };
  return { error: null };
}

export async function createFolder(folderName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .insert({ user_id: userId, folder_name: folderName });

  if (error) {
    if (error.code === "23505") return { error: "Folder name already exists" };
    return { error: error.message };
  }
  return { error: null };
}

/** Rename an active folder by UUID (not by display name). */
export async function renameFolder(folderId: string, newName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const trimmed = newName.trim();
  if (!trimmed) return { error: "Name required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ folder_name: trimmed })
    .eq("user_id", userId)
    .eq("id", folderId)
    .is("deleted_at", null);

  if (error) return { error: error.message };
  return { error: null };
}

export async function softDeleteFolder(folderId: string): Promise<TrashActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", folderId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, reason: "forbidden" };
  if (!data) {
    const { data: row } = await supabase
      .from("folders")
      .select("id, deleted_at")
      .eq("user_id", userId)
      .eq("id", folderId)
      .maybeSingle();
    if (!row) return { ok: false, reason: "not_found" };
    if (row.deleted_at) return { ok: false, reason: "already_trashed" };
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, state: "trashed", folderId: data.id };
}

export async function restoreFolder(folderId: string): Promise<TrashActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("folders")
    .select("id, deleted_at")
    .eq("user_id", userId)
    .eq("id", folderId)
    .maybeSingle();

  if (fetchErr) return { ok: false, reason: "forbidden" };
  if (!existing) return { ok: false, reason: "not_restorable" };
  if (existing.deleted_at === null) return { ok: false, reason: "already_active" };

  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: null })
    .eq("user_id", userId)
    .eq("id", folderId);

  if (error) return { ok: false, reason: "not_restorable" };
  return { ok: true, state: "restored", folderId };
}

export type TrashedFolderRow = {
  id: string;
  folder_name: string;
  deleted_at: string;
};

/** Soft-deleted cookbooks still within the retention window (see `purge_trashed_rows`). */
export async function getTrashedFolders(): Promise<{
  error: string | null;
  data: TrashedFolderRow[];
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const cutoff = trashListCutoffIso();
  const { data, error } = await supabase
    .from("folders")
    .select("id, folder_name, deleted_at")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff)
    .order("deleted_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { error: null, data: (data ?? []) as TrashedFolderRow[] };
}

export async function getFolderRecipes(folderName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("folder_name", folderName)
    .is("deleted_at", null)
    .maybeSingle();
  if (!folder) return { error: "Folder not found", data: [] };

  const { data, error } = await supabase
    .from("folder_recipes")
    .select(`recipes (${RECIPE_WITH_NUTRITION})`)
    .eq("folder_id", folder.id);
  if (error) return { error: error.message, data: [] };

  const list = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes)
    .filter((r): r is Record<string, unknown> => r != null && recipeRowNotTrashed(r as Record<string, unknown>));
  return { error: null, data: list as import("@/lib/types").RecipeRow[] };
}

export async function getFolderPageData(folderName: string): Promise<{
  error: string | null;
  data: {
    folder: {
      id: string;
      folder_name: string;
      cover_image_url: string | null;
      created_at: string;
    };
    recipes: import("@/lib/types").RecipeRow[];
  } | null;
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, folder_name, cover_image_url, created_at")
    .eq("user_id", userId)
    .eq("folder_name", folderName)
    .is("deleted_at", null)
    .maybeSingle();

  if (folderError) return { error: folderError.message, data: null };
  if (!folder) return { error: "Folder not found", data: null };

  const { data, error } = await supabase
    .from("folder_recipes")
    .select(`recipes (${RECIPE_WITH_NUTRITION})`)
    .eq("folder_id", folder.id);
  if (error) return { error: error.message, data: null };

  const recipes = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes)
    .filter((r): r is Record<string, unknown> => r != null && recipeRowNotTrashed(r as Record<string, unknown>));

  return {
    error: null,
    data: {
      folder,
      recipes: recipes as import("@/lib/types").RecipeRow[],
    },
  };
}

/** Resolve whether an active folder exists for deep-link routing (Option A). */
export async function getActiveFolderMetaByName(folderName: string): Promise<{
  error: string | null;
  data: { id: string; folder_name: string; cover_image_url: string | null; created_at: string } | null;
}> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .select("id, folder_name, cover_image_url, created_at")
    .eq("user_id", userId)
    .eq("folder_name", folderName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { error: error.message, data: null };
  return { error: null, data };
}

export async function addRecipeToFolder(
  folderName: string,
  payload: RecipePayload | string
) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();

  let recipeUuid: string;
  if (typeof payload === "string") {
    const { data: recipe } = await supabase
      .from("recipes")
      .select("id")
      .eq("recipe_id", payload)
      .is("deleted_at", null)
      .maybeSingle();
    if (!recipe) return { error: "Recipe not found" };
    recipeUuid = recipe.id;
  } else {
    const { getOrCreateRecipe } = await import("@/app/actions/recipes");
    const res = await getOrCreateRecipe(payload);
    if (res.error || !res.data) return { error: res.error ?? "Failed to get/create recipe" };
    recipeUuid = res.data.id;
  }

  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("folder_name", folderName)
    .is("deleted_at", null)
    .maybeSingle();
  if (!folder) return { error: "Folder not found" };

  const { error } = await supabase
    .from("folder_recipes")
    .insert({ folder_id: folder.id, recipe_id: recipeUuid });

  if (error) {
    if (error.code === "23505") return { error: "Recipe already in folder" };
    return { error: error.message };
  }
  return { error: null, data: { folderName, recipeId: recipeUuid } };
}
