import type { RecipeRow } from "@/lib/types";

import { recipeDisplayEnergyKcal } from "@/lib/recipe-select";

export function pickRecipeNutritionSource(
  row: Pick<RecipeRow, "recipe_nutrition">
): "fdc" | "estimated" | "mixed" | "incomplete" | null {
  const raw = row.recipe_nutrition;
  const n = Array.isArray(raw) ? raw[0] : raw;
  if (!n || typeof n !== "object" || !("nutrition_source" in n)) return null;
  const s = (n as { nutrition_source?: unknown }).nutrition_source;
  if (s === "fdc" || s === "estimated" || s === "mixed" || s === "incomplete") return s;
  return null;
}

/**
 * Human-readable explanation for recipe-level "Incomplete" (unresolved lines, API gaps, etc.).
 * Safe for tooltips; does not expose secrets.
 */
export function incompleteNutritionSummary(row: RecipeRow): string {
  const lines = row.recipe_ingredient_lines;
  if (!lines || !Array.isArray(lines)) {
    return "Totals may omit one or more ingredients (Incomplete). Open the recipe for per-line detail.";
  }
  const unresolved = lines.filter((l) => l.line_nutrition_source === "unresolved");
  if (unresolved.length === 0) {
    return "Nutrition is still incomplete—try saving again or pick a USDA food for ambiguous lines.";
  }
  const reasons = [
    ...new Set(
      unresolved.map((l) => l.estimation_reason?.trim()).filter((s): s is string => Boolean(s))
    ),
  ];
  if (reasons.length === 0) {
    return `${unresolved.length} ingredient line(s) are not included in this total. Use Pick food where shown or fix quantity/units.`;
  }
  const head = reasons.slice(0, 4).join(" • ");
  return reasons.length > 4 ? `${head}…` : head;
}

/**
 * Recipe-level tooltip for the "Nutrition: …" label (source + why).
 */
export function recipeNutritionSourceDetail(
  row: RecipeRow,
  source: "fdc" | "estimated" | "mixed" | "incomplete"
): string {
  if (source === "incomplete") {
    return incompleteNutritionSummary(row);
  }
  if (source === "mixed") {
    return "Some ingredients use USDA data and others are estimated; totals combine both.";
  }
  if (source === "fdc") {
    return "All contributing lines are matched to USDA FoodData Central.";
  }
  if (source === "estimated") {
    return "Nutrition was estimated for each ingredient (no full USDA match for every line).";
  }
  return "";
}

export function formatRecipeEnergyKcalDisplay(row: RecipeRow): {
  numeric: number;
  kcalText: string;
  title?: string;
} {
  const numeric = recipeDisplayEnergyKcal(row);
  const src = pickRecipeNutritionSource(row);
  if (src === "incomplete") {
    return {
      numeric,
      kcalText: `~${numeric}`,
      title: incompleteNutritionSummary(row),
    };
  }
  return { numeric, kcalText: String(numeric) };
}
