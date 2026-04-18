import type { RecipeNutritionSnapshot, RecipeRow } from "@/lib/types";

/** PostgREST select fragment: recipe columns plus 1:1 `recipe_nutrition` and per-line provenance. */
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
