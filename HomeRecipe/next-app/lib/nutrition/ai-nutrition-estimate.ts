/**
 * Phase C: AI fallback for unresolved ingredient lines (server-only).
 * Uses OpenAI JSON schema output; recipe totals must be recomputed from lines in sync-recipe-nutrition.
 */

import OpenAI from "openai";

import type { FdcCandidate } from "@/lib/nutrition/resolve-line";

const MODEL = "gpt-4.1-nano";
const TEMPERATURE = 0.2;

/** Prefer dedicated key; falls back to video recipe reasoning key so one OpenAI key can suffice in dev. */
export function getNutritionEstimateApiKey(): string | null {
  const k =
    process.env.NUTRITION_ESTIMATE_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_REASONING_API_KEY?.trim();
  return k || null;
}

export type StructuredLineForAi = {
  line_index: number;
  item: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  fdc_candidates: FdcCandidate[];
};

export type AiLineEstimate = {
  line_index: number;
  source: "fdc" | "estimated";
  fdc_id: number | null;
  grams: number | null;
  macros: { kcal: number; protein_g: number; fat_g: number; carb_g: number } | null;
};

const RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    estimates: {
      type: "array" as const,
      description:
        "One entry per line that needs estimation. Use source=fdc only when picking an FDC food and grams; server will recompute macros from USDA data. Use source=estimated with macros for the line when FDC cannot apply.",
      items: {
        type: "object" as const,
        properties: {
          line_index: { type: "integer" as const },
          source: { type: "string" as const, enum: ["fdc", "estimated"] },
          fdc_id: { type: ["integer", "null"] as const },
          grams: { type: ["number", "null"] as const },
          macros: {
            type: ["object", "null"] as const,
            properties: {
              kcal: { type: "number" as const },
              protein_g: { type: "number" as const },
              fat_g: { type: "number" as const },
              carb_g: { type: "number" as const },
            },
            required: ["kcal", "protein_g", "fat_g", "carb_g"] as const,
            additionalProperties: false,
          },
        },
        required: ["line_index", "source", "fdc_id", "grams", "macros"] as const,
        additionalProperties: false,
      },
    },
  },
  required: ["estimates"] as const,
  additionalProperties: false,
};

function buildUserPayload(input: {
  recipe_title: string;
  servings: number | null;
  fdc_resolved_line_indices: number[];
  lines_to_estimate: StructuredLineForAi[];
}): string {
  return JSON.stringify(
    {
      recipe_title: input.recipe_title,
      servings: input.servings,
      fdc_resolved_line_indices: input.fdc_resolved_line_indices,
      lines_to_estimate: input.lines_to_estimate.map((l) => ({
        line_index: l.line_index,
        item: l.item,
        quantity: l.quantity,
        unit: l.unit,
        notes: l.notes,
        fdc_candidates: l.fdc_candidates.map((c) => ({
          fdc_id: c.fdc_id,
          description: c.description,
          score: c.score,
        })),
      })),
    },
    null,
    2
  );
}

const SYSTEM_PROMPT =
  "You estimate nutrition for recipe ingredient lines when USDA FoodData Central matching failed. " +
  "You receive lines that still need resolution; other line indices are already finalized from USDA and MUST NOT be changed. " +
  "For each line in lines_to_estimate, return exactly one estimate entry with matching line_index. " +
  "Prefer source=fdc with a plausible fdc_id from fdc_candidates when one fits the ingredient and quantity; include grams for that line. " +
  "If no candidate fits, use source=estimated with realistic total macros for the amount of that ingredient (macros are totals for the line, not per 100g). " +
  "For source=fdc, set macros to null. For source=estimated, set fdc_id null and grams to your assumed total grams if helpful, else null. " +
  "Use finite non-negative numbers only. Return strict JSON only.";

function validateEstimate(e: AiLineEstimate): boolean {
  if (!Number.isInteger(e.line_index) || e.line_index < 0) return false;
  if (e.source !== "fdc" && e.source !== "estimated") return false;
  if (e.source === "fdc") {
    if (e.fdc_id == null || !Number.isFinite(e.fdc_id) || e.fdc_id <= 0) return false;
    if (e.grams == null || !Number.isFinite(e.grams) || e.grams <= 0) return false;
    return true;
  }
  // estimated
  if (e.macros == null) return false;
  const { kcal, protein_g, fat_g, carb_g } = e.macros;
  const nums = [kcal, protein_g, fat_g, carb_g];
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 50_000)) return false;
  if (kcal > 20_000) return false;
  return true;
}

/**
 * Returns validated per-line AI outputs for unresolved indices only, or null if the API key is missing or the call fails.
 */
export async function estimateNutritionLinesWithAi(input: {
  apiKey: string;
  recipe_title: string;
  servings: number | null;
  fdc_resolved_line_indices: number[];
  lines_to_estimate: StructuredLineForAi[];
}): Promise<AiLineEstimate[] | null> {
  if (input.lines_to_estimate.length === 0) {
    return [];
  }

  const openai = new OpenAI({ apiKey: input.apiKey });
  const userContent = buildUserPayload({
    recipe_title: input.recipe_title,
    servings: input.servings,
    fdc_resolved_line_indices: input.fdc_resolved_line_indices,
    lines_to_estimate: input.lines_to_estimate,
  });

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nutrition_line_estimates",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn("nutrition AI: empty response");
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("nutrition AI: invalid JSON");
      return null;
    }

    const rec = parsed as { estimates?: unknown };
    if (!Array.isArray(rec.estimates)) {
      return null;
    }

    const out: AiLineEstimate[] = [];
    const wanted = new Set(input.lines_to_estimate.map((l) => l.line_index));
    for (const row of rec.estimates) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const line_index = Number(r.line_index);
      const source = r.source;
      const fdc_id = r.fdc_id == null ? null : Number(r.fdc_id);
      const grams = r.grams == null ? null : Number(r.grams);
      let macros: AiLineEstimate["macros"] = null;
      if (r.macros && typeof r.macros === "object") {
        const m = r.macros as Record<string, unknown>;
        macros = {
          kcal: Number(m.kcal),
          protein_g: Number(m.protein_g),
          fat_g: Number(m.fat_g),
          carb_g: Number(m.carb_g),
        };
      }
      if (source !== "fdc" && source !== "estimated") continue;
      const est: AiLineEstimate = {
        line_index,
        source,
        fdc_id: Number.isFinite(fdc_id as number) ? (fdc_id as number) : null,
        grams: Number.isFinite(grams as number) ? (grams as number) : null,
        macros,
      };
      if (!wanted.has(est.line_index)) continue;
      if (!validateEstimate(est)) continue;
      out.push(est);
    }

    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("nutrition AI error:", msg);
    return null;
  }
}
