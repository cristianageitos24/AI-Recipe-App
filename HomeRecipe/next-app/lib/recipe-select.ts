/** PostgREST select fragment: recipe columns plus 1:1 `recipe_nutrition`. */
export const RECIPE_WITH_NUTRITION =
  "*, recipe_nutrition(energy_kcal, protein_g, fat_g, carb_g, nutrition_source)";
