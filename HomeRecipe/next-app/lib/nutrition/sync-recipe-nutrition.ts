import type { SupabaseClient } from "@supabase/supabase-js";

import {
  estimateNutritionLinesWithAi,
  getNutritionEstimateApiKey,
  type StructuredLineForAi,
} from "@/lib/nutrition/ai-nutrition-estimate";
import { parseIngredientLine } from "@/lib/nutrition/parse-ingredient-line";
import {
  buildFdcResolvedLine,
  resolveIngredientLine,
  type ResolvedLine,
  type ResolvedLineWithCandidates,
} from "@/lib/nutrition/resolve-line";
import type { FdcCandidateSnapshot, RecipeIngredientLineSnapshot } from "@/lib/types";

export type RecipeNutritionSourceRollup = "fdc" | "estimated" | "mixed" | "incomplete";

function rollupLineSources(
  lines: Array<{ line_nutrition_source: "fdc" | "estimated" | "unresolved" }>
): RecipeNutritionSourceRollup {
  if (lines.length === 0) return "incomplete";
  if (lines.some((l) => l.line_nutrition_source === "unresolved")) {
    return "incomplete";
  }

  const hasFdc = lines.some((l) => l.line_nutrition_source === "fdc");
  const hasEst = lines.some((l) => l.line_nutrition_source === "estimated");
  if (hasFdc && hasEst) return "mixed";
  if (hasFdc) return "fdc";
  if (hasEst) return "estimated";
  return "incomplete";
}

const FDC_RELEASE_LABEL = "2025-12-18+2018-04";

type WorkingLine = ResolvedLine & {
  fdc_candidates: ResolvedLineWithCandidates["fdc_candidates"];
};

function cloneResolved(r: ResolvedLineWithCandidates): ResolvedLine {
  return {
    fdc_id: r.fdc_id,
    fdc_match_score: r.fdc_match_score,
    line_nutrition_source: r.line_nutrition_source,
    grams: r.grams,
    ml: r.ml,
    estimation_reason: r.estimation_reason,
    nutrients_scaled: { ...r.nutrients_scaled },
  };
}

export type ComputedRecipeNutritionLineRow = {
  line_index: number;
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  item: string | null;
  notes: string | null;
  fdc_id: number | null;
  fdc_match_score: number | null;
  line_nutrition_source: "fdc" | "estimated" | "unresolved";
  grams: number | null;
  ml: number | null;
  estimation_reason: string | null;
  fdc_candidates: unknown | null;
};

export type ComputedRecipeNutrition = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  nutrition_source: RecipeNutritionSourceRollup;
  lines: ComputedRecipeNutritionLineRow[];
};

export function computedNutritionToIngredientSnapshots(
  lines: ComputedRecipeNutritionLineRow[]
): RecipeIngredientLineSnapshot[] {
  return lines.map((r) => ({
    line_index: r.line_index,
    item: r.item,
    raw_text: r.raw_text,
    line_nutrition_source: r.line_nutrition_source,
    fdc_id: r.fdc_id,
    estimation_reason: r.estimation_reason,
    fdc_candidates: Array.isArray(r.fdc_candidates)
      ? (r.fdc_candidates as FdcCandidateSnapshot[])
      : null,
  }));
}

/**
 * Resolve ingredient lines to totals + per-line FDC/AI rows (no DB writes).
 * Used by the video worker to embed nutrition on `extracted_recipe` before the recipe row exists.
 */
export async function computeRecipeNutritionFromLines(
  svc: SupabaseClient,
  params: {
    rawLines: string[];
    recipeTitle: string;
    /** Passed to AI estimate context (e.g. extracted servings). */
    servings: number | null | undefined;
    lineFdcOverrides?: Record<number, number>;
  }
): Promise<ComputedRecipeNutrition> {
  const rawLines = params.rawLines.map((s) => s.trim()).filter(Boolean);
  const recipeTitle = params.recipeTitle.trim() || "Recipe";
  const servings =
    params.servings != null && Number.isFinite(Number(params.servings))
      ? Number(params.servings)
      : null;

  if (rawLines.length === 0) {
    return {
      energy_kcal: 0,
      protein_g: 0,
      fat_g: 0,
      carb_g: 0,
      nutrition_source: "incomplete",
      lines: [],
    };
  }

  const parsedLines = rawLines.map((raw) => parseIngredientLine(raw));

  const deterministic: ResolvedLineWithCandidates[] = [];
  let apiSearchDisabled = false;
  for (let i = 0; i < parsedLines.length; i++) {
    const override = params.lineFdcOverrides?.[i];
    const row = await resolveIngredientLine(svc, parsedLines[i], {
      forceFdcId: override != null ? override : undefined,
      apiSearchDisabled,
    });
    deterministic.push(row);
    if (row.disableApiForRestOfSync) {
      apiSearchDisabled = true;
    }
  }

  const working: WorkingLine[] = deterministic.map((d) => ({
    ...cloneResolved(d),
    fdc_candidates: d.fdc_candidates,
  }));

  const unresolvedIndices = working
    .map((w, i) => (w.line_nutrition_source === "unresolved" ? i : -1))
    .filter((i) => i >= 0);

  const fdcResolvedLineIndices = working
    .map((w, i) => (w.line_nutrition_source === "fdc" ? i : -1))
    .filter((i) => i >= 0);

  const apiKey = getNutritionEstimateApiKey();
  if (apiKey && unresolvedIndices.length > 0) {
    const lines_to_estimate: StructuredLineForAi[] = unresolvedIndices.map((idx) => {
      const p = parsedLines[idx];
      return {
        line_index: idx,
        item: p.item || null,
        quantity: p.quantity,
        unit: p.unit,
        notes: p.notes,
        fdc_candidates: working[idx].fdc_candidates,
      };
    });

    const aiRows = await estimateNutritionLinesWithAi({
      apiKey,
      recipe_title: recipeTitle,
      servings,
      fdc_resolved_line_indices: fdcResolvedLineIndices,
      lines_to_estimate,
    });

    if (aiRows) {
      const byIndex = new Map(aiRows.map((e) => [e.line_index, e]));
      for (const idx of unresolvedIndices) {
        const est = byIndex.get(idx);
        if (!est) continue;

        if (est.source === "fdc" && est.fdc_id != null && est.grams != null) {
          const fdcLine = await buildFdcResolvedLine(svc, est.fdc_id, est.grams, null, {
            skipLiveUsdaDetail: apiSearchDisabled,
          });
          if (fdcLine) {
            working[idx] = {
              ...fdcLine,
              fdc_candidates: working[idx].fdc_candidates,
            };
          }
        } else if (est.source === "estimated" && est.macros) {
          working[idx] = {
            fdc_id: null,
            fdc_match_score: null,
            line_nutrition_source: "estimated",
            grams: est.grams,
            ml: null,
            estimation_reason: "AI estimate",
            nutrients_scaled: {
              kcal: est.macros.kcal,
              protein_g: est.macros.protein_g,
              fat_g: est.macros.fat_g,
              carb_g: est.macros.carb_g,
            },
            fdc_candidates: working[idx].fdc_candidates,
          };
        }
      }
    }
  }

  let totalK = 0;
  let totalP = 0;
  let totalF = 0;
  let totalC = 0;

  const lines: ComputedRecipeNutritionLineRow[] = [];
  const sourceAcc: Array<{
    line_nutrition_source: "fdc" | "estimated" | "unresolved";
  }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const parsed = parsedLines[i];
    const w = working[i];

    totalK += w.nutrients_scaled.kcal;
    totalP += w.nutrients_scaled.protein_g;
    totalF += w.nutrients_scaled.fat_g;
    totalC += w.nutrients_scaled.carb_g;

    const cand =
      w.line_nutrition_source === "unresolved" && working[i].fdc_candidates?.length
        ? working[i].fdc_candidates
        : null;

    lines.push({
      line_index: i,
      raw_text: parsed.raw_text || null,
      quantity: parsed.quantity,
      unit: parsed.unit,
      item: parsed.item || null,
      notes: parsed.notes,
      fdc_id: w.fdc_id,
      fdc_match_score: w.fdc_match_score,
      line_nutrition_source: w.line_nutrition_source,
      grams: w.grams,
      ml: w.ml,
      estimation_reason: w.estimation_reason,
      fdc_candidates: cand,
    });

    sourceAcc.push({ line_nutrition_source: w.line_nutrition_source });
  }

  const nutrition_source = rollupLineSources(sourceAcc);

  return {
    energy_kcal: Math.round(totalK * 10000) / 10000,
    protein_g: Math.round(totalP * 10000) / 10000,
    fat_g: Math.round(totalF * 10000) / 10000,
    carb_g: Math.round(totalC * 10000) / 10000,
    nutrition_source,
    lines,
  };
}

export type SyncRecipeNutritionOptions = {
  /** Per line index: use this FDC id instead of automatic resolution (user pick). */
  lineFdcOverrides?: Record<number, number>;
};

/**
 * Persist nutrition already computed elsewhere (video worker / extract preview).
 * Avoids a second full FDC+AI pass during cookbook save (common Vercel timeout → empty macros).
 */
export async function applyRecipeNutritionSnapshot(
  svc: SupabaseClient,
  recipeId: string,
  nutrition: RecipeNutritionSnapshot,
  ingredientLines?: RecipeIngredientLineSnapshot[] | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const energy = Number(nutrition.energy_kcal);
  const protein = Number(nutrition.protein_g);
  const fat = Number(nutrition.fat_g);
  const carb = Number(nutrition.carb_g);
  if (![energy, protein, fat, carb].every((n) => Number.isFinite(n))) {
    return { ok: false, error: "Invalid nutrition snapshot numbers" };
  }

  const source = nutrition.nutrition_source;
  if (
    source !== "fdc" &&
    source !== "estimated" &&
    source !== "mixed" &&
    source !== "incomplete"
  ) {
    return { ok: false, error: "Invalid nutrition_source on snapshot" };
  }

  let servings: number | null = null;
  if (nutrition.servings != null && Number.isFinite(Number(nutrition.servings))) {
    servings = Number(nutrition.servings);
  }

  if (ingredientLines && ingredientLines.length > 0) {
    await svc.from("recipe_ingredient_lines").delete().eq("recipe_id", recipeId);
    const ids = [
      ...new Set(
        ingredientLines
          .map((l) => l.fdc_id)
          .filter((id): id is number => id != null && Number.isFinite(Number(id)))
          .map(Number)
      ),
    ];
    const knownFdc = new Set<number>();
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data: foods } = await svc
        .from("fdc_foods")
        .select("fdc_id")
        .in("fdc_id", slice);
      for (const f of foods ?? []) {
        knownFdc.add(Number((f as { fdc_id: number }).fdc_id));
      }
    }
    const lineRows = ingredientLines.map((line) => {
      const fdcId =
        line.fdc_id != null && knownFdc.has(Number(line.fdc_id))
          ? Number(line.fdc_id)
          : null;
      const candidates = Array.isArray(line.fdc_candidates)
        ? line.fdc_candidates.filter((c) => knownFdc.has(Number(c.fdc_id)))
        : line.fdc_candidates;
      return {
        recipe_id: recipeId,
        line_index: line.line_index,
        raw_text: line.raw_text,
        item: line.item,
        quantity: null,
        unit: null,
        notes: null,
        fdc_id: fdcId,
        fdc_match_score: null,
        line_nutrition_source:
          fdcId == null && line.line_nutrition_source === "fdc"
            ? ("estimated" as const)
            : line.line_nutrition_source,
        grams: null,
        ml: null,
        estimation_reason: line.estimation_reason,
        fdc_candidates: candidates?.length ? candidates : null,
      };
    });
    const { error: insErr } = await svc.from("recipe_ingredient_lines").insert(lineRows);
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  const { error: nutErr } = await svc.from("recipe_nutrition").upsert(
    {
      recipe_id: recipeId,
      energy_kcal: energy,
      protein_g: protein,
      fat_g: fat,
      carb_g: carb,
      nutrition_source: source,
      computed_at: new Date().toISOString(),
      fdc_release_label: FDC_RELEASE_LABEL,
      servings,
    },
    { onConflict: "recipe_id" }
  );
  if (nutErr) {
    return { ok: false, error: nutErr.message };
  }

  const { error: calErr } = await svc
    .from("recipes")
    .update({ calories: energy })
    .eq("id", recipeId);
  if (calErr) {
    return { ok: false, error: calErr.message };
  }

  return { ok: true };
}

export async function syncRecipeNutritionForRecipe(
  svc: SupabaseClient,
  recipeId: string,
  options?: SyncRecipeNutritionOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: recipe, error: rErr } = await svc
    .from("recipes")
    .select("id, ingredient_lines, recipe_label")
    .eq("id", recipeId)
    .single();

  if (rErr || !recipe) {
    return { ok: false, error: rErr?.message ?? "Recipe not found" };
  }

  const { data: existingNut } = await svc
    .from("recipe_nutrition")
    .select("servings")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  let servings: number | null = null;
  if (existingNut?.servings != null) {
    const n = Number(existingNut.servings);
    if (Number.isFinite(n)) servings = n;
  }

  const text = (recipe.ingredient_lines as string | null)?.trim() ?? "";
  const rawLines = text
    ? text.split("***").map((s) => s.trim()).filter(Boolean)
    : [];

  await svc.from("recipe_ingredient_lines").delete().eq("recipe_id", recipeId);

  const recipeTitle = String(recipe.recipe_label ?? "").trim() || "Recipe";

  const computed = await computeRecipeNutritionFromLines(svc, {
    rawLines,
    recipeTitle,
    servings,
    lineFdcOverrides: options?.lineFdcOverrides,
  });

  // Drop fdc_ids that are not in local fdc_foods (API matches can outlive / miss local import).
  const candidateIds = new Set<number>();
  for (const row of computed.lines) {
    if (row.fdc_id != null && Number.isFinite(Number(row.fdc_id))) {
      candidateIds.add(Number(row.fdc_id));
    }
    if (Array.isArray(row.fdc_candidates)) {
      for (const c of row.fdc_candidates) {
        if (c?.fdc_id != null && Number.isFinite(Number(c.fdc_id))) {
          candidateIds.add(Number(c.fdc_id));
        }
      }
    }
  }
  const knownFdc = new Set<number>();
  const idList = [...candidateIds];
  const chunk = 200;
  for (let i = 0; i < idList.length; i += chunk) {
    const slice = idList.slice(i, i + chunk);
    const { data: foods } = await svc
      .from("fdc_foods")
      .select("fdc_id")
      .in("fdc_id", slice);
    for (const f of foods ?? []) {
      knownFdc.add(Number((f as { fdc_id: number }).fdc_id));
    }
  }

  const lineRows = computed.lines.map((row) => {
    const fdcId =
      row.fdc_id != null && knownFdc.has(Number(row.fdc_id))
        ? Number(row.fdc_id)
        : null;
    const candidates = Array.isArray(row.fdc_candidates)
      ? row.fdc_candidates.filter((c) => knownFdc.has(Number(c.fdc_id)))
      : row.fdc_candidates;
    return {
      recipe_id: recipeId,
      ...row,
      fdc_id: fdcId,
      fdc_candidates: candidates?.length ? candidates : null,
      // Keep line source; totals already computed. Missing local FDC id should not fail the save.
      line_nutrition_source:
        fdcId == null && row.line_nutrition_source === "fdc"
          ? ("estimated" as const)
          : row.line_nutrition_source,
    };
  });

  if (lineRows.length) {
    const { error: insErr } = await svc.from("recipe_ingredient_lines").insert(lineRows);
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  const { error: nutErr } = await svc.from("recipe_nutrition").upsert(
    {
      recipe_id: recipeId,
      energy_kcal: computed.energy_kcal,
      protein_g: computed.protein_g,
      fat_g: computed.fat_g,
      carb_g: computed.carb_g,
      nutrition_source: computed.nutrition_source,
      computed_at: new Date().toISOString(),
      fdc_release_label: FDC_RELEASE_LABEL,
      servings: existingNut?.servings ?? null,
    },
    { onConflict: "recipe_id" }
  );

  if (nutErr) {
    return { ok: false, error: nutErr.message };
  }

  const { error: calErr } = await svc
    .from("recipes")
    .update({ calories: computed.energy_kcal })
    .eq("id", recipeId);

  if (calErr) {
    return { ok: false, error: calErr.message };
  }

  return { ok: true };
}
