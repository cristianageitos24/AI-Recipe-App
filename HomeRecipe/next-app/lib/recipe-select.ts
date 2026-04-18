/** PostgREST select fragment: recipe columns plus 1:1 `recipe_nutrition` and per-line provenance. */
export const RECIPE_WITH_NUTRITION =
  "*, recipe_nutrition(energy_kcal, protein_g, fat_g, carb_g, nutrition_source, servings), recipe_ingredient_lines(line_index, item, raw_text, line_nutrition_source, fdc_id, estimation_reason)";
