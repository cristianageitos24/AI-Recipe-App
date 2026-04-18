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

function cloneResolved(r: ResolvedLine): ResolvedLine {
  return {
    ...r,
    nutrients_scaled: { ...r.nutrients_scaled },
  };
}

export async function syncRecipeNutritionForRecipe(
  svc: SupabaseClient,
  recipeId: string
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

  const parsedLines = rawLines.map((raw) => parseIngredientLine(raw));

  /** Phase B: deterministic resolution for every line. */
  const deterministic: ResolvedLineWithCandidates[] = [];
  for (let i = 0; i < parsedLines.length; i++) {
    deterministic.push(await resolveIngredientLine(svc, parsedLines[i]));
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

  /** Phase C: AI only for unresolved lines; never modify FDC-resolved lines. */
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
          const fdcLine = await buildFdcResolvedLine(svc, est.fdc_id, est.grams, null);
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

  const lineRows: Array<{
    recipe_id: string;
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
  }> = [];

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

    lineRows.push({
      recipe_id: recipeId,
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
    });

    sourceAcc.push({ line_nutrition_source: w.line_nutrition_source });
  }

  const nutrition_source = rollupLineSources(sourceAcc);

  if (lineRows.length) {
    const { error: insErr } = await svc.from("recipe_ingredient_lines").insert(lineRows);
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  const energy_kcal = Math.round(totalK * 10000) / 10000;
  const protein_g = Math.round(totalP * 10000) / 10000;
  const fat_g = Math.round(totalF * 10000) / 10000;
  const carb_g = Math.round(totalC * 10000) / 10000;

  const { error: nutErr } = await svc.from("recipe_nutrition").upsert(
    {
      recipe_id: recipeId,
      energy_kcal,
      protein_g,
      fat_g,
      carb_g,
      nutrition_source,
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
    .update({ calories: energy_kcal })
    .eq("id", recipeId);

  if (calErr) {
    return { ok: false, error: calErr.message };
  }

  return { ok: true };
}
