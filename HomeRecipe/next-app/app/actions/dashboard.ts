"use server";

import type { RecipeRow } from "@/lib/types";
import { getFavorites } from "@/app/actions/favorites";
import { getFolders } from "@/app/actions/folders";
import { getMealDates } from "@/app/actions/meal-dates";
import { getGroceryTrips } from "@/app/actions/grocery-trips";
import { getSuggestedRecipes } from "@/app/actions/search";

type FolderResults = {
  folders: string[];
  results: Record<string, RecipeRow[]>;
};

export async function getHomeBootstrap() {
  const [favRes, folderRes, mealRes] = await Promise.all([
    getFavorites(),
    getFolders(),
    getMealDates(),
  ]);

  const favorites = (favRes.data ?? []) as RecipeRow[];
  const folderResults = (folderRes.data ?? { folders: [], results: {} }) as FolderResults;

  const savedIds = new Set<string>();
  for (const recipe of favorites) savedIds.add(recipe.recipe_id);
  for (const folderName of folderResults.folders) {
    for (const recipe of folderResults.results[folderName] ?? []) {
      savedIds.add(recipe.recipe_id);
    }
  }

  const suggestedRes = await getSuggestedRecipes(Array.from(savedIds));

  return {
    error: favRes.error ?? folderRes.error ?? mealRes.error ?? suggestedRes.error,
    data: {
      favorites,
      folders: folderResults.folders,
      results: folderResults.results,
      mealDates: mealRes.data ?? [],
      suggestedRecipes: (suggestedRes.data ?? []) as RecipeRow[],
    },
  };
}

export async function getCookbookBootstrap() {
  const [favRes, folderRes] = await Promise.all([getFavorites(), getFolders()]);
  return {
    error: favRes.error ?? folderRes.error,
    data: {
      favorites: (favRes.data ?? []) as RecipeRow[],
      folders: folderRes.data?.folders ?? [],
      folderCovers: folderRes.data?.folderCovers ?? {},
      results: (folderRes.data?.results ?? {}) as Record<string, RecipeRow[]>,
    },
  };
}

export async function getCalendarBootstrap() {
  const [mealRes, tripsRes, folderRes, favRes] = await Promise.all([
    getMealDates(),
    getGroceryTrips(),
    getFolders(),
    getFavorites(),
  ]);

  return {
    error: mealRes.error ?? tripsRes.error ?? folderRes.error ?? favRes.error,
    data: {
      mealDates: mealRes.data ?? [],
      groceryTrips: tripsRes.data ?? [],
      folders: folderRes.data?.folders ?? [],
      results: (folderRes.data?.results ?? {}) as Record<string, RecipeRow[]>,
      favorites: (favRes.data ?? []) as RecipeRow[],
    },
  };
}
