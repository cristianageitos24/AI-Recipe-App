"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
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
  results: Record<string, unknown[]>;
  folderCovers: Record<string, string | null>;
};

function emptyFoldersData(): GetFoldersData {
  return { folders: [], results: {}, folderCovers: {} };
}

export async function getFolders() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: emptyFoldersData() };

  const supabase = await createClient();
  const { data: foldersData, error: foldersError } = await supabase
    .from("folders")
    .select("id, folder_name, cover_image_url")
    .eq("user_id", userId)
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
  for (const f of folders as { folder_name: string; cover_image_url: string | null }[]) {
    folderCovers[f.folder_name] = f.cover_image_url ?? null;
  }

  const folderIds = folders.map((f: { id: string }) => f.id);
  const { data: folderRecipesRows, error: frError } = await supabase
    .from("folder_recipes")
    .select(`folder_id, recipes (${RECIPE_WITH_NUTRITION})`)
    .in("folder_id", folderIds);

  if (frError) return { error: frError.message, data: emptyFoldersData() };

  const idToName = new Map(folders.map((f: { id: string; folder_name: string }) => [f.id, f.folder_name]));
  const results: Record<string, unknown[]> = {};
  for (const name of idToName.values()) results[name as string] = [];

  for (const row of folderRecipesRows ?? []) {
    const r = row as { folder_id: string; recipes: unknown };
    const name = idToName.get(r.folder_id);
    if (name != null && r.recipes != null) results[name].push(r.recipes);
  }

  return {
    error: null,
    data: {
      folders: folders.map((f: { folder_name: string }) => f.folder_name),
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
  if (typeof folderNameRaw !== "string" || !folderNameRaw.trim()) {
    return { error: "Missing cookbook name.", url: null };
  }
  const folderName = folderNameRaw.trim();

  const labelSlug = slugifyForPath(folderName) || "cookbook";
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
  const { error: updateError } = await supabase
    .from("folders")
    .update({ cover_image_url: urlData.publicUrl })
    .eq("user_id", userId)
    .eq("folder_name", folderName);

  if (updateError) {
    return { error: updateError.message, url: null };
  }
  return { error: null, url: urlData.publicUrl };
}

export async function clearCookbookCoverImage(folderName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ cover_image_url: null })
    .eq("user_id", userId)
    .eq("folder_name", folderName);

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

export async function renameFolder(oldName: string, newName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ folder_name: newName })
    .eq("user_id", userId)
    .eq("folder_name", oldName);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteFolder(folderName: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("folder_name", folderName)
    .single();
  if (!folder) return { error: "Folder not found" };

  const { error } = await supabase.from("folders").delete().eq("id", folder.id);
  if (error) return { error: error.message };
  return { error: null };
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
    .single();
  if (!folder) return { error: "Folder not found", data: [] };

  const { data, error } = await supabase
    .from("folder_recipes")
    .select(`recipes (${RECIPE_WITH_NUTRITION})`)
    .eq("folder_id", folder.id);
  if (error) return { error: error.message, data: [] };

  const list = (data ?? [])
    .map((row: { recipes: unknown }) => row.recipes)
    .filter((r): r is Record<string, unknown> => r != null);
  return { error: null, data: list as import("@/lib/types").RecipeRow[] };
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
      .single();
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
    .single();
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
