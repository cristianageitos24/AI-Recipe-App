import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeIngredientName } from "@/lib/ingredient-normalize";
import { DATA_TYPE_PRIORITY } from "@/lib/nutrition/constants";
import {
  fdcFoodDetailCached,
  fdcSearchFoodsCached,
  type NutrientsPer100g,
} from "@/lib/nutrition/fdc-api";
import { getNutrientsPer100gFromDb } from "@/lib/nutrition/nutrients-from-db";
import type { ParsedIngredientLine } from "@/lib/nutrition/parse-ingredient-line";
import { estimateGrams } from "@/lib/nutrition/to-grams";

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function searchTermFromParsed(parsed: ParsedIngredientLine): string {
  const norm = normalizeIngredientName(parsed.item || parsed.raw_text);
  if (norm?.search_name) return norm.search_name.slice(0, 80);
  return (parsed.item || parsed.raw_text).toLowerCase().trim().slice(0, 80);
}

type FdcFoodRow = { fdc_id: number; description: string; data_type: string };

function rankLocal(
  rows: FdcFoodRow[],
  term: string
): { fdc_id: number; description: string; data_type: string; score: number }[] {
  const t = term.toLowerCase();
  return rows
    .map((r) => {
      const d = r.description.toLowerCase();
      let score = 0;
      if (d === t) score = 1;
      else if (d.startsWith(t)) score = 0.9;
      else if (d.includes(t)) score = 0.65;
      else score = 0.2;
      const dt =
        DATA_TYPE_PRIORITY[r.data_type] ??
        DATA_TYPE_PRIORITY.sr_legacy_food + 5;
      const adjusted = score - dt * 0.01;
      return { ...r, score: adjusted };
    })
    .sort((a, b) => b.score - a.score);
}

export type ResolvedLine = {
  fdc_id: number | null;
  fdc_match_score: number | null;
  line_nutrition_source: "fdc" | "estimated" | "unresolved";
  grams: number | null;
  ml: number | null;
  estimation_reason: string | null;
  nutrients_scaled: { kcal: number; protein_g: number; fat_g: number; carb_g: number };
};

function scaleNutrients(n100: NutrientsPer100g, grams: number): ResolvedLine["nutrients_scaled"] {
  const f = grams / 100;
  return {
    kcal: (n100.kcal * f),
    protein_g: (n100.protein_g * f),
    fat_g: (n100.fat_g * f),
    carb_g: (n100.carb_g * f),
  };
}

const LOCAL_SCORE_MIN = 0.55;

export async function resolveIngredientLine(
  svc: SupabaseClient,
  parsed: ParsedIngredientLine
): Promise<ResolvedLine> {
  const empty: ResolvedLine = {
    fdc_id: null,
    fdc_match_score: null,
    line_nutrition_source: "unresolved",
    grams: null,
    ml: null,
    estimation_reason: null,
    nutrients_scaled: { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0 },
  };

  const term = searchTermFromParsed(parsed);
  if (!term || !parsed.item?.trim()) {
    return empty;
  }

  const grams = estimateGrams({
    quantity: parsed.quantity,
    unit: parsed.unit,
    item: parsed.item,
  });

  if (grams == null) {
    return {
      ...empty,
      estimation_reason: "Could not convert quantity/unit to grams.",
    };
  }

  const pattern = `%${escapeIlike(term)}%`;
  const { data: localRows, error: localErr } = await svc
    .from("fdc_foods")
    .select("fdc_id, description, data_type")
    .ilike("description", pattern)
    .limit(45);

  if (localErr) {
    console.warn("local fdc_foods search", localErr.message);
  }

  let chosen: {
    fdc_id: number;
    score: number;
    description: string;
    data_type: string;
  } | null = null;

  const locals = (localRows ?? []) as FdcFoodRow[];
  if (locals.length) {
    const ranked = rankLocal(locals, term);
    const best = ranked[0];
    if (best && best.score >= LOCAL_SCORE_MIN) {
      chosen = {
        fdc_id: best.fdc_id,
        score: best.score,
        description: best.description,
        data_type: best.data_type,
      };
    }
  }

  if (!chosen) {
    const apiHits = await fdcSearchFoodsCached(svc, term);
    const sorted = [...apiHits].sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      return sb - sa;
    });
    const top = sorted[0];
    if (top) {
      const raw = top.score ?? 0;
      const normalizedScore =
        raw > 0 && raw <= 1 ? raw : Math.min(0.99, raw / 500);
      chosen = {
        fdc_id: top.fdcId,
        score: normalizedScore,
        description: top.description,
        data_type: top.dataType ?? "api",
      };
    }
  }

  if (!chosen) {
    return {
      ...empty,
      grams,
      estimation_reason: "No confident FDC food match.",
    };
  }

  let per100 = await getNutrientsPer100gFromDb(svc, chosen.fdc_id);
  if (!per100) {
    per100 = await fdcFoodDetailCached(svc, chosen.fdc_id);
  }

  if (!per100) {
    return {
      ...empty,
      fdc_id: chosen.fdc_id,
      fdc_match_score: chosen.score,
      grams,
      line_nutrition_source: "unresolved",
      estimation_reason: "Nutrients unavailable for matched food.",
    };
  }

  const nutrients_scaled = scaleNutrients(per100, grams);

  return {
    fdc_id: chosen.fdc_id,
    fdc_match_score: chosen.score,
    line_nutrition_source: "fdc",
    grams,
    ml: null,
    estimation_reason: null,
    nutrients_scaled,
  };
}
