"use server";

import { createClient } from "@/utils/supabase/server";
import type { RecipePayload } from "@/lib/types";

export async function getFolders() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", data: { folders: [], results: {} } };

  const { data: foldersData, error: foldersError } = await supabase
    .from("folders")
    .select("id, folder_name")
    .eq("user_id", user.id)
    .order("folder_name");

  if (foldersError) return { error: foldersError.message, data: { folders: [], results: {} } };

  const folders = foldersData ?? [];
  const results: Record<string, unknown[]> = {};

  for (const folder of folders) {
    const { data: recipes } = await supabase
      .from("folder_recipes")
      .select("recipes (*)")
      .eq("folder_id", folder.id);
    const list = (recipes ?? []).map((row: { recipes: unknown }) => row.recipes).filter(Boolean);
    results[folder.folder_name] = list;
  }

  return {
    error: null,
    data: {
      folders: folders.map((f: { folder_name: string }) => f.folder_name),
      results,
    },
  };
}

export async function createFolder(folderName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("folders")
    .insert({ user_id: user.id, folder_name: folderName });

  if (error) {
    if (error.code === "23505") return { error: "Folder name already exists" };
    return { error: error.message };
  }
  return { error: null };
}

export async function renameFolder(oldName: string, newName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("folders")
    .update({ folder_name: newName })
    .eq("user_id", user.id)
    .eq("folder_name", oldName);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteFolder(folderName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", user.id)
    .eq("folder_name", folderName)
    .single();
  if (!folder) return { error: "Folder not found" };

  const { error } = await supabase.from("folders").delete().eq("id", folder.id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function getFolderRecipes(folderName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", data: [] };

  const { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", user.id)
    .eq("folder_name", folderName)
    .single();
  if (!folder) return { error: "Folder not found", data: [] };

  const { data, error } = await supabase
    .from("folder_recipes")
    .select("recipes (*)")
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

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
    .eq("user_id", user.id)
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
  return { error: null };
}
