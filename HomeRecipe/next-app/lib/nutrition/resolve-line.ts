import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeIngredientName } from "@/lib/ingredient-normalize";
import { DATA_TYPE_PRIORITY } from "@/lib/nutrition/constants";
import {
  fdcFoodDetailCached,
  fdcSearchFoodsCached,
  getFdcApiKey,
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

type DataTypeKey = keyof typeof DATA_TYPE_PRIORITY | "unknown";

function typeRankFromKey(k: DataTypeKey): number {
  if (k === "unknown") return 40;
  return DATA_TYPE_PRIORITY[k] ?? 35;
}

type MergedEntry = {
  fdc_id: number;
  description: string;
  normScore: number;
  typeKey: DataTypeKey;
};

function mapLocalDataType(dt: string): DataTypeKey {
  if (dt in DATA_TYPE_PRIORITY) return dt as DataTypeKey;
  return "unknown";
}

function mergedEntryFromLocal(r: {
  fdc_id: number;
  description: string;
  data_type: string;
  score: number;
}): MergedEntry {
  return {
    fdc_id: r.fdc_id,
    description: r.description,
    normScore: Math.min(1, Math.max(0, r.score)),
    typeKey: mapLocalDataType(r.data_type),
  };
}

function mergedEntryFromApiHit(top: FdcSearchFood): MergedEntry {
  return {
    fdc_id: top.fdcId,
    description: top.description,
    normScore: normalizeApiScore(top.score ?? 0),
    typeKey: mapApiDataTypeToKey(top.dataType),
  };
}

/** Sort: lower type rank (Foundation first), then higher normScore. */
function compareMerged(a: MergedEntry, b: MergedEntry): number {
  const ta = typeRankFromKey(a.typeKey);
  const tb = typeRankFromKey(b.typeKey);
  if (ta !== tb) return ta - tb;
  return b.normScore - a.normScore;
}

function dedupeMerged(entries: MergedEntry[]): MergedEntry[] {
  const m = new Map<number, MergedEntry>();
  for (const e of entries) {
    const prev = m.get(e.fdc_id);
    if (!prev || compareMerged(e, prev) < 0) {
      m.set(e.fdc_id, e);
    }
  }
  return [...m.values()].sort(compareMerged);
}

/**
 * Merge local + general API + branded API hits. Foundation/SR outrank branded when scores are close
 * because compareMerged uses data type before score.
 */
function mergeAllSources(
  rankedLocal: ReturnType<typeof rankLocal>,
  apiGeneralSorted: FdcSearchFood[],
  apiBrandedSorted: FdcSearchFood[]
): MergedEntry[] {
  const raw: MergedEntry[] = [];
  for (const r of rankedLocal) {
    raw.push(mergedEntryFromLocal(r));
  }
  for (const h of apiGeneralSorted) {
    raw.push(mergedEntryFromApiHit(h));
  }
  for (const h of apiBrandedSorted) {
    raw.push(mergedEntryFromApiHit(h));
  }
  return dedupeMerged(raw);
}

const STRONG_LOCAL_SCORE = 0.92;
const AMBIGUITY_GAP = 0.11;
const AMBIGUITY_MIN_SECOND = 0.38;

function isAmbiguousPair(a: MergedEntry, b: MergedEntry): boolean {
  if (b.normScore < AMBIGUITY_MIN_SECOND) return false;
  if (a.typeKey === b.typeKey) {
    return a.normScore - b.normScore < AMBIGUITY_GAP;
  }
  return false;
}

function toFdcCandidates(merged: MergedEntry[]): FdcCandidate[] {
  return merged.slice(0, 12).map((e) => ({
    fdc_id: e.fdc_id,
    description: e.description,
    score: e.normScore,
  }));
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

export type ResolveLineOptions = {
  /** Skip search and use this FDC id (user-confirmed pick). */
  forceFdcId?: number;
};

export async function resolveIngredientLine(
  svc: SupabaseClient,
  parsed: ParsedIngredientLine,
  options?: ResolveLineOptions
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

  if (options?.forceFdcId != null) {
    const forced = await buildFdcResolvedLine(svc, options.forceFdcId, grams, 1);
    if (forced) {
      return { ...forced, fdc_candidates: [] };
    }
    return {
      ...empty,
      grams,
      estimation_reason: "Could not load nutrients for selected food.",
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

  const locals = (localRows ?? []) as FdcFoodRow[];
  const rankedLocal = locals.length ? rankLocal(locals, term) : [];

  const hasApi = Boolean(getFdcApiKey());
  const strongLocal =
    rankedLocal[0] != null && rankedLocal[0].score >= STRONG_LOCAL_SCORE;

  let apiGeneralSorted: FdcSearchFood[] = [];
  let apiBrandedSorted: FdcSearchFood[] = [];

  if (hasApi && !strongLocal) {
    const [gen, br] = await Promise.all([
      fdcSearchFoodsCached(svc, term),
      fdcSearchFoodsCached(svc, term, { dataType: "Branded" }),
    ]);
    apiGeneralSorted = rankApiHits(gen);
    apiBrandedSorted = rankApiHits(br);
  }

  if (strongLocal && rankedLocal.length > 0) {
    const sortedLocalOnly = dedupeMerged(rankedLocal.map(mergedEntryFromLocal));
    if (
      sortedLocalOnly.length >= 2 &&
      isAmbiguousPair(sortedLocalOnly[0], sortedLocalOnly[1])
    ) {
      return {
        ...empty,
        grams,
        estimation_reason: "Multiple plausible USDA matches — pick a food below.",
        fdc_candidates: toFdcCandidates(sortedLocalOnly),
      };
    }
    const best = sortedLocalOnly[0]!;
    const resolved = await buildFdcResolvedLine(svc, best.fdc_id, grams, best.normScore);
    if (resolved) {
      return { ...resolved, fdc_candidates: [] };
    }
    return {
      ...empty,
      fdc_id: best.fdc_id,
      fdc_match_score: best.normScore,
      grams,
      line_nutrition_source: "unresolved",
      estimation_reason: "Nutrients unavailable for matched food.",
      fdc_candidates: dedupeCandidates([
        { fdc_id: best.fdc_id, description: best.description, score: best.normScore },
      ]),
    };
  }

  const merged = mergeAllSources(rankedLocal, apiGeneralSorted, apiBrandedSorted);

  if (merged.length === 0) {
    return {
      ...empty,
      grams,
      estimation_reason: "No confident FDC food match.",
      fdc_candidates: [],
    };
  }

  const top = merged[0];
  const second = merged[1];
  if (second && isAmbiguousPair(top, second)) {
    return {
      ...empty,
      grams,
      estimation_reason: "Multiple plausible USDA matches — pick a food below.",
      fdc_candidates: toFdcCandidates(merged),
    };
  }

  const chosen = top;
  const resolved = await buildFdcResolvedLine(svc, chosen.fdc_id, grams, chosen.normScore);
  if (!resolved) {
    return {
      ...empty,
      fdc_id: chosen.fdc_id,
      fdc_match_score: chosen.normScore,
      grams,
      line_nutrition_source: "unresolved",
      estimation_reason: "Nutrients unavailable for matched food.",
      fdc_candidates: dedupeCandidates([
        ...toFdcCandidates(merged),
        {
          fdc_id: chosen.fdc_id,
          description: chosen.description,
          score: chosen.normScore,
        },
      ]),
    };
  }

  return {
    ...resolved,
    fdc_candidates: [],
  };
}
