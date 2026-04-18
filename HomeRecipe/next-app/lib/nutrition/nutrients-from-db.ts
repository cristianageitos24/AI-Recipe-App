import type { SupabaseClient } from "@supabase/supabase-js";

import { FDC_NUTRIENT } from "@/lib/nutrition/constants";
import type { NutrientsPer100g } from "@/lib/nutrition/fdc-api";

export async function getNutrientsPer100gFromDb(
  svc: SupabaseClient,
  fdcId: number
): Promise<NutrientsPer100g | null> {
  const { data, error } = await svc
    .from("fdc_nutrients")
    .select("nutrient_id, amount")
    .eq("fdc_id", fdcId)
    .in("nutrient_id", [
      FDC_NUTRIENT.ENERGY_KCAL,
      FDC_NUTRIENT.PROTEIN,
      FDC_NUTRIENT.FAT,
      FDC_NUTRIENT.CARB,
    ]);

  if (error || !data?.length) return null;

  let kcal = 0;
  let protein_g = 0;
  let fat_g = 0;
  let carb_g = 0;

  for (const row of data) {
    const nid = row.nutrient_id as number;
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    if (nid === FDC_NUTRIENT.ENERGY_KCAL) kcal += amt;
    else if (nid === FDC_NUTRIENT.PROTEIN) protein_g += amt;
    else if (nid === FDC_NUTRIENT.FAT) fat_g += amt;
    else if (nid === FDC_NUTRIENT.CARB) carb_g += amt;
  }

  return { kcal, protein_g, fat_g, carb_g };
}
