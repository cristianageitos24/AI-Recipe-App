import type { RecipeNutritionSnapshot, RecipeRow } from "@/lib/types";

/**
 * Card / list reads: enough for recipe cards and calendars.
 * Detail (ingredients, steps, FDC line provenance) loads via `getRecipeFull`.
 */
export const RECIPE_LIST_COLUMNS =
  "id, recipe_id, recipe_label, calories, cuisine_type, meal_type, time_in_minutes, image_url, website_url, created_at, deleted_at, user_id, expires_at, recipe_nutrition(energy_kcal, nutrition_source)" as const;

/**
 * Folder / curated collection grids that open `RecipeFullView` from list data
 * (ingredient_lines + steps) without a second round-trip. Still omits heavy
 * `recipe_ingredient_lines` / `fdc_candidates`.
 */
export const RECIPE_FOLDER_COLUMNS =
  "id, recipe_id, recipe_label, calories, cuisine_type, meal_type, time_in_minutes, image_url, website_url, ingredient_lines, steps, created_at, deleted_at, user_id, expires_at, recipe_nutrition(energy_kcal, nutrition_source)" as const;

/** Blur-wall teasers for Free users (no ingredients/steps/nutrition). */
export const RECIPE_TEASER_COLUMNS =
  "id, recipe_id, recipe_label, image_url, cuisine_type, meal_type, user_id" as const;

/** Full recipe graph for open/detail views only. */
export const RECIPE_WITH_NUTRITION =
  "*, recipe_nutrition(energy_kcal, protein_g, fat_g, carb_g, nutrition_source, servings), recipe_ingredient_lines(line_index, item, raw_text, line_nutrition_source, fdc_id, estimation_reason, fdc_candidates)";

/** Prefer synced `recipe_nutrition.energy_kcal` over legacy `recipes.calories` for display. */
export function recipeDisplayEnergyKcal(
  row: Pick<RecipeRow, "calories" | "recipe_nutrition">
): number {
  const raw = row.recipe_nutrition;
  const n = Array.isArray(raw) ? raw[0] : raw;
  if (n && typeof n === "object" && "energy_kcal" in n) {
    const k = Number((n as RecipeNutritionSnapshot).energy_kcal);
    if (Number.isFinite(k)) return Math.round(k);
  }
  return Math.round(Number(row.calories));
}
