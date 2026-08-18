"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getHomeBootstrap } from "@/app/actions/dashboard";
import { primeCookbooksData, readCookbooksData } from "@/lib/cookbooks-cache";
import { computeHomeStatCounts } from "@/lib/stat-filters";
import type { RecipeRow } from "@/lib/types";

type FolderWithCount = { folderName: string; count: number };
type MealDay = {
  date: string;
  recipes: Array<RecipeRow & { eventID: string }>;
};

function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(year, month - 1, day, 12);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(dt);
}

export function useHomeData() {
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [ownedRecipes, setOwnedRecipes] = useState<RecipeRow[]>([]);
  const [mealDates, setMealDates] = useState<MealDay[]>([]);
  const [foldersWithCounts, setFoldersWithCounts] = useState<FolderWithCount[]>(
    [],
  );
  const [folderRecipesByName, setFolderRecipesByName] = useState<
    Record<string, RecipeRow[]>
  >({});
  const [isHomeDataLoading, setIsHomeDataLoading] = useState(true);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(true);

  const applyFolderData = useCallback(
    (folders: string[], results: Record<string, RecipeRow[]>) => {
      setFoldersWithCounts(
        folders.map((name) => ({
          folderName: name,
          count: (results[name] ?? []).length,
        })),
      );
      setFolderRecipesByName(results);
      setIsCollectionsLoading(false);
    },
    [],
  );

  useEffect(() => {
    let isCurrent = true;
    const cachedFolders = readCookbooksData();
    if (cachedFolders) {
      cachedFolders.then((res) => {
        if (!isCurrent || !res.data) return;
        applyFolderData(
          res.data.folders,
          (res.data.results ?? {}) as Record<string, RecipeRow[]>,
        );
      });
    }

    getHomeBootstrap()
      .then((res) => {
        if (!isCurrent || !res.data) return;
        setFavorites(res.data.favorites);
        applyFolderData(
          res.data.folders,
          (res.data.results ?? {}) as Record<string, RecipeRow[]>,
        );
        primeCookbooksData({
          folders: res.data.folders,
          results: res.data.results ?? {},
        });
        setMealDates((res.data.mealDates ?? []) as MealDay[]);
      })
      .finally(() => {
        if (isCurrent) setIsHomeDataLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [applyFolderData]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeRow[]>([]);

  useEffect(() => {
    getHomeBootstrap().then((res) => {
      if (!res.data) return;
      setFavorites(res.data.favorites);
      setOwnedRecipes(res.data.ownedRecipes ?? []);
      setFoldersWithCounts(
        res.data.folders.map((name) => ({
          folderName: name,
          count: (res.data.results[name] ?? []).length,
        })),
      );
      setFolderRecipesByName(
        (res.data.results ?? {}) as Record<string, RecipeRow[]>,
      );
      setMealDates((res.data.mealDates ?? []) as MealDay[]);
      setSuggestedRecipes((res.data.suggestedRecipes ?? []) as RecipeRow[]);
    });
  }, []);

  const handleFavoriteChange = useCallback(
    (recipe: RecipeRow, isFavorited: boolean) => {
      if (isFavorited) {
        setFavorites((prev) =>
          prev.some((r) => r.recipe_id === recipe.recipe_id)
            ? prev
            : [...prev, recipe],
        );
      } else {
        setFavorites((prev) =>
          prev.filter((r) => r.recipe_id !== recipe.recipe_id),
        );
      }
    },
    [],
  );

  const favoriteIds = useMemo(
    () => new Set(favorites.map((r) => r.recipe_id)),
    [favorites],
  );

  const homeStats = useMemo(() => {
    const savedMap = new Map<string, RecipeRow>();
    const engagement = new Map<string, { recipe: RecipeRow; score: number }>();

    const bump = (recipe: RecipeRow, amount: number) => {
      const prev = engagement.get(recipe.recipe_id);
      if (prev) {
        prev.score += amount;
      } else {
        engagement.set(recipe.recipe_id, { recipe, score: amount });
      }
    };

    for (const recipe of favorites) {
      savedMap.set(recipe.recipe_id, recipe);
      bump(recipe, 2);
    }
    for (const recipes of Object.values(folderRecipesByName)) {
      for (const recipe of recipes) {
        if (!savedMap.has(recipe.recipe_id))
          savedMap.set(recipe.recipe_id, recipe);
        bump(recipe, 1);
      }
    }
    for (const day of mealDates) {
      for (const recipe of day.recipes) bump(recipe, 1);
    }

    const cuisineCounts = new Map<string, number>();
    for (const recipe of savedMap.values()) {
      const cuisine = recipe.cuisine_type?.trim();
      if (!cuisine) continue;
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
    }

    const counts = computeHomeStatCounts(ownedRecipes, favorites.length);

    return {
      ...counts,
      mostCommonCuisine:
        [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "N/A",
    };
  }, [favorites, folderRecipesByName, mealDates, ownedRecipes]);

  const upcomingMealPlans = useMemo(() => {
    if (mealDates.length === 0) return [];
    const today = getLocalDateKey();
    const sorted = [...mealDates].sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = sorted.filter((entry) => entry.date >= today);
    return upcoming.slice(0, 2).map((plan) => ({
      ...plan,
      label: plan.date === today ? "Today" : formatDateKey(plan.date),
      isToday: plan.date === today,
    }));
  }, [mealDates]);

  return {
    favorites,
    foldersWithCounts,
    isHomeDataLoading,
    isCollectionsLoading,
    homeStats,
    upcomingMealPlans,
    favoriteIds,
    handleFavoriteChange,
    suggestedRecipes,
  };
}
