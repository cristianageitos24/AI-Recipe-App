import type { SupabaseClient } from "@supabase/supabase-js";

import { parseIngredientLine } from "@/lib/nutrition/parse-ingredient-line";
import { resolveIngredientLine } from "@/lib/nutrition/resolve-line";

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

export async function syncRecipeNutritionForRecipe(
  svc: SupabaseClient,
  recipeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: recipe, error: rErr } = await svc
    .from("recipes")
    .select("id, ingredient_lines")
    .eq("id", recipeId)
    .single();

  if (rErr || !recipe) {
    return { ok: false, error: rErr?.message ?? "Recipe not found" };
  }

  const text = (recipe.ingredient_lines as string | null)?.trim() ?? "";
  const rawLines = text
    ? text.split("***").map((s) => s.trim()).filter(Boolean)
    : [];

  await svc.from("recipe_ingredient_lines").delete().eq("recipe_id", recipeId);

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
    const raw = rawLines[i];
    const parsed = parseIngredientLine(raw);
    const resolved = await resolveIngredientLine(svc, parsed);

    totalK += resolved.nutrients_scaled.kcal;
    totalP += resolved.nutrients_scaled.protein_g;
    totalF += resolved.nutrients_scaled.fat_g;
    totalC += resolved.nutrients_scaled.carb_g;

    lineRows.push({
      recipe_id: recipeId,
      line_index: i,
      raw_text: parsed.raw_text || null,
      quantity: parsed.quantity,
      unit: parsed.unit,
      item: parsed.item || null,
      notes: parsed.notes,
      fdc_id: resolved.fdc_id,
      fdc_match_score: resolved.fdc_match_score,
      line_nutrition_source: resolved.line_nutrition_source,
      grams: resolved.grams,
      ml: resolved.ml,
      estimation_reason: resolved.estimation_reason,
    });

    sourceAcc.push({ line_nutrition_source: resolved.line_nutrition_source });
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
