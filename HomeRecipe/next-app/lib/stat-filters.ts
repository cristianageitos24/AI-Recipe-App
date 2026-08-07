import type { RecipeRow } from "@/lib/types";

export type StatFilterId = "all" | "favorites" | "week" | "imported";

export const STAT_FILTER_IDS: readonly StatFilterId[] = [
  "all",
  "favorites",
  "week",
  "imported",
] as const;

export function parseStatFilter(raw: string | null | undefined): StatFilterId {
  if (raw === "favorites" || raw === "week" || raw === "imported") return raw;
  return "all";
}

export function startOfWeekSunday(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonthLocal(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function formatShortMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonthName(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(date);
}

export function isRecipeThisWeek(
  recipe: Pick<RecipeRow, "created_at">,
  now = new Date()
): boolean {
  if (!recipe.created_at) return false;
  const createdAt = new Date(recipe.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= startOfWeekSunday(now);
}

export function isImportedThisMonth(
  recipe: Pick<RecipeRow, "created_at" | "website_url">,
  now = new Date()
): boolean {
  if (!recipe.website_url?.trim()) return false;
  if (!recipe.created_at) return false;
  const createdAt = new Date(recipe.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= startOfMonthLocal(now);
}

export function filterOwnedByStat(
  recipes: RecipeRow[],
  filter: Exclude<StatFilterId, "favorites">,
  now = new Date()
): RecipeRow[] {
  if (filter === "week") return recipes.filter((r) => isRecipeThisWeek(r, now));
  if (filter === "imported") return recipes.filter((r) => isImportedThisMonth(r, now));
  return recipes;
}

export function sortRecipesByCreatedAtDesc(recipes: RecipeRow[]): RecipeRow[] {
  return [...recipes].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  });
}

export function getStatFilterTitle(filter: StatFilterId): string {
  switch (filter) {
    case "favorites":
      return "Favorites";
    case "week":
      return "Recipes This Week";
    case "imported":
      return "Imported This Month";
    case "all":
    default:
      return "All Recipes";
  }
}

export function getStatFilterHref(filter: StatFilterId): string {
  return `/dashboard/recipes?filter=${filter}`;
}

export function getStatCardCaption(filter: StatFilterId, count: number): string {
  switch (filter) {
    case "all":
      return count === 0 ? "Start building your cookbook" : "View all recipes";
    case "favorites":
      return count === 0 ? "No favorites yet" : "View your favorites";
    case "week":
      return "View this week’s recipes";
    case "imported":
      return count === 0 ? "No imports yet" : "View imports";
  }
}

export function getStatFilterSubtitle(
  filter: StatFilterId,
  count: number,
  now = new Date()
): string {
  const recipeWord = count === 1 ? "recipe" : "recipes";
  switch (filter) {
    case "favorites":
      return `${count} liked ${recipeWord}`;
    case "week":
      return `Added since ${formatShortMonthDay(startOfWeekSunday(now))}`;
    case "imported":
      return `URL imports in ${formatMonthName(now)}`;
    case "all":
    default:
      return `${count} ${recipeWord} in your library`;
  }
}

export type StatEmptyCta = {
  label: string;
  href: string;
};

export function getStatEmptyCopy(filter: StatFilterId): {
  message: string;
  ctas: StatEmptyCta[];
} {
  switch (filter) {
    case "favorites":
      return {
        message: "Heart recipes you love and they’ll show up here.",
        ctas: [{ label: "Browse all recipes", href: getStatFilterHref("all") }],
      };
    case "week":
      return {
        message: "No recipes added since the start of this week yet.",
        ctas: [
          { label: "Create recipe", href: "/dashboard/create-recipe" },
          { label: "Import URL", href: "/dashboard/import-url" },
        ],
      };
    case "imported":
      return {
        message: "No URL imports this month yet.",
        ctas: [{ label: "Import URL", href: "/dashboard/import-url" }],
      };
    case "all":
    default:
      return {
        message: "Your library is empty. Create a recipe or import one from the web.",
        ctas: [
          { label: "Create recipe", href: "/dashboard/create-recipe" },
          { label: "Import URL", href: "/dashboard/import-url" },
        ],
      };
  }
}

export function computeHomeStatCounts(
  ownedRecipes: RecipeRow[],
  favoritesCount: number,
  now = new Date()
) {
  let recipesThisWeek = 0;
  let importedThisMonth = 0;
  for (const recipe of ownedRecipes) {
    if (isRecipeThisWeek(recipe, now)) recipesThisWeek++;
    if (isImportedThisMonth(recipe, now)) importedThisMonth++;
  }
  return {
    totalRecipesSaved: ownedRecipes.length,
    favoritesCount,
    recipesThisWeek,
    importedThisMonth,
  };
}
