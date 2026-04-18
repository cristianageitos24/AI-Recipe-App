 "use server";
 
 import { auth } from "@clerk/nextjs/server";
 import { createClient } from "@/utils/supabase/server";
 import { RECIPE_WITH_NUTRITION } from "@/lib/recipe-select";
import type { RecipePayload } from "@/lib/types";
 import { upsertIngredientsFromRecipe } from "@/app/actions/ingredients";
 
 export async function getFolders() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: { folders: [], results: {} } };

  const supabase = await createClient();
  const { data: foldersData, error: foldersError } = await supabase
    .from("folders")
    .select("id, folder_name")
    .eq("user_id", userId)
    .order("folder_name");

  if (foldersError) return { error: foldersError.message, data: { folders: [], results: {} } };

  const folders = foldersData ?? [];
  if (folders.length === 0) {
    return {
      error: null,
      data: { folders: [], results: {} },
    };
  }

  const folderIds = folders.map((f: { id: string }) => f.id);
  const { data: folderRecipesRows, error: frError } = await supabase
    .from("folder_recipes")
    .select(`folder_id, recipes (${RECIPE_WITH_NUTRITION})`)
    .in("folder_id", folderIds);

  if (frError) return { error: frError.message, data: { folders: [], results: {} } };

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
      results,
    },
  };
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

    // For newly saved recipes (including video/manual), ensure their ingredients
    // are reflected in the canonical ingredients table.
    if (payload.ingredient_lines) {
      await upsertIngredientsFromRecipe(payload.ingredient_lines);
    }
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
