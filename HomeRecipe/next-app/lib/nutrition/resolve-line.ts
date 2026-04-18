import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeIngredientName } from "@/lib/ingredient-normalize";
import { DATA_TYPE_PRIORITY } from "@/lib/nutrition/constants";
import {
  fdcFoodDetailCached,
  fdcSearchFoodsCached,
  type FdcSearchFood,
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

/** Top FDC hits from the same local/API search used for deterministic matching (for AI context). */
export type FdcCandidate = { fdc_id: number; description: string; score: number };

export type ResolvedLineWithCandidates = ResolvedLine & {
  fdc_candidates: FdcCandidate[];
};

export function scaleNutrientsToGrams(
  n100: NutrientsPer100g,
  grams: number
): ResolvedLine["nutrients_scaled"] {
  const f = grams / 100;
  return {
    kcal: n100.kcal * f,
    protein_g: n100.protein_g * f,
    fat_g: n100.fat_g * f,
    carb_g: n100.carb_g * f,
  };
}

function normalizeApiScore(raw: number): number {
  return raw > 0 && raw <= 1 ? raw : Math.min(0.99, raw / 500);
}

/** Map FDC `/foods/search` `dataType` strings to `DATA_TYPE_PRIORITY` keys. */
function mapApiDataTypeToKey(
  dataType?: string
): keyof typeof DATA_TYPE_PRIORITY | "unknown" {
  if (!dataType) return "unknown";
  const d = dataType.toLowerCase();
  if (d.includes("foundation")) return "foundation_food";
  if (d.includes("sr") && d.includes("legacy")) return "sr_legacy_food";
  if (d.includes("legacy")) return "sr_legacy_food";
  if (d.includes("brand")) return "branded_food";
  if (d.includes("survey") || d.includes("fndds")) return "survey_fndds_food";
  return "unknown";
}

function apiFoodTypeRank(dataType?: string): number {
  const k = mapApiDataTypeToKey(dataType);
  if (k === "unknown") return 50;
  return DATA_TYPE_PRIORITY[k] ?? 45;
}

/** Prefer Foundation / SR over Branded when scores are comparable (single or merged API responses). */
function rankApiHits(hits: FdcSearchFood[]): FdcSearchFood[] {
  return [...hits].sort((a, b) => {
    const pa = apiFoodTypeRank(a.dataType);
    const pb = apiFoodTypeRank(b.dataType);
    if (pa !== pb) return pa - pb;
    const sa = normalizeApiScore(a.score ?? 0);
    const sb = normalizeApiScore(b.score ?? 0);
    return sb - sa;
  });
}

function dedupeCandidates(cands: FdcCandidate[]): FdcCandidate[] {
  const m = new Map<number, FdcCandidate>();
  for (const c of cands) {
    const prev = m.get(c.fdc_id);
    if (!prev || c.score > prev.score) {
      m.set(c.fdc_id, c);
    }
  }
  return [...m.values()].sort((a, b) => b.score - a.score).slice(0, 12);
}

function candidatesFromRankedLocal(
  ranked: { fdc_id: number; description: string; score: number }[]
): FdcCandidate[] {
  return ranked.slice(0, 8).map((r) => ({
    fdc_id: r.fdc_id,
    description: r.description,
    score: r.score,
  }));
}

function candidatesFromApiHits(sorted: FdcSearchFood[]): FdcCandidate[] {
  return sorted.slice(0, 8).map((top) => ({
    fdc_id: top.fdcId,
    description: top.description,
    score: normalizeApiScore(top.score ?? 0),
  }));
}

/**
 * Fetch nutrients and build an FDC-backed line (used after deterministic resolution or AI-picked fdc_id).
 */
export async function buildFdcResolvedLine(
  svc: SupabaseClient,
  fdcId: number,
  grams: number,
  matchScore: number | null
): Promise<ResolvedLine | null> {
  let per100 = await getNutrientsPer100gFromDb(svc, fdcId);
  if (!per100) {
    per100 = await fdcFoodDetailCached(svc, fdcId);
  }
  if (!per100) return null;
  return {
    fdc_id: fdcId,
    fdc_match_score: matchScore,
    line_nutrition_source: "fdc",
    grams,
    ml: null,
    estimation_reason: null,
    nutrients_scaled: scaleNutrientsToGrams(per100, grams),
  };
}

const LOCAL_SCORE_MIN = 0.55;

export async function resolveIngredientLine(
  svc: SupabaseClient,
  parsed: ParsedIngredientLine
): Promise<ResolvedLineWithCandidates> {
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
    return { ...empty, fdc_candidates: [] };
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
      fdc_candidates: [],
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
  let rankedLocal: ReturnType<typeof rankLocal> = [];
  let apiSorted: FdcSearchFood[] = [];

  if (locals.length) {
    rankedLocal = rankLocal(locals, term);
    const best = rankedLocal[0];
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
    let apiHits = await fdcSearchFoodsCached(svc, term);
    if (apiHits.length === 0) {
      apiHits = await fdcSearchFoodsCached(svc, term, { dataType: "Branded" });
    }
    apiSorted = rankApiHits(apiHits);
    const top = apiSorted[0];
    if (top) {
      const normalizedScore = normalizeApiScore(top.score ?? 0);
      chosen = {
        fdc_id: top.fdcId,
        score: normalizedScore,
        description: top.description,
        data_type: top.dataType ?? "api",
      };
    }
  }

  const failureCandidates = dedupeCandidates([
    ...candidatesFromRankedLocal(rankedLocal),
    ...candidatesFromApiHits(apiSorted),
  ]);

  if (!chosen) {
    return {
      ...empty,
      grams,
      estimation_reason: "No confident FDC food match.",
      fdc_candidates: failureCandidates,
    };
  }

  const resolved = await buildFdcResolvedLine(svc, chosen.fdc_id, grams, chosen.score);
  if (!resolved) {
    return {
      ...empty,
      fdc_id: chosen.fdc_id,
      fdc_match_score: chosen.score,
      grams,
      line_nutrition_source: "unresolved",
      estimation_reason: "Nutrients unavailable for matched food.",
      fdc_candidates: dedupeCandidates([
        ...failureCandidates,
        {
          fdc_id: chosen.fdc_id,
          description: chosen.description,
          score: chosen.score,
        },
      ]),
    };
  }

  return {
    ...resolved,
    fdc_candidates: [],
  };
}
