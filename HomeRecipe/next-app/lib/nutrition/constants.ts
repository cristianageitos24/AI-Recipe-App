/** FDC nutrient.id values used for recipe rollup (per 100 g edible portion). */
export const FDC_NUTRIENT = {
  ENERGY_KCAL: 1008,
  PROTEIN: 1003,
  FAT: 1004,
  CARB: 1005,
} as const;

export const DATA_TYPE_PRIORITY: Record<string, number> = {
  foundation_food: 0,
  sr_legacy_food: 1,
  branded_food: 2,
  survey_fndds_food: 3,
  sample_food: 4,
};
