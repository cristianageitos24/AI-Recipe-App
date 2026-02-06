/**
 * AI recipe extraction from video OCR + transcript
 * Uses OpenAI GPT-4.1 nano with structured JSON output; validates and retries with stricter instruction on failure.
 */

import OpenAI from "openai";
import type { ExtractedRecipe, ExtractedRecipeIngredient } from "./types";

const MODEL = "gpt-4.1-nano";
const TEMPERATURE = 0.2;

/** JSON schema for structured output (strict; matches ExtractedRecipe) */
const EXTRACTED_RECIPE_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, description: "Recipe title" },
    servings: {
      type: ["number", "null"] as const,
      description: "Number of servings, or null if unknown",
    },
    cook_time_minutes: {
      type: ["number", "null"] as const,
      description: "Total cook time in minutes, or null if unknown",
    },
    ingredients: {
      type: "array" as const,
      description: "Deduplicated, normalized ingredient list",
      items: {
        type: "object" as const,
        properties: {
          item: { type: "string" as const, description: "Ingredient name" },
          quantity: {
            type: ["number", "null"] as const,
            description: "Numeric quantity, or null",
          },
          unit: {
            type: ["string", "null"] as const,
            description: "Unit (e.g. cups, tbsp), or null",
          },
          notes: {
            type: ["string", "null"] as const,
            description: "Optional note (e.g. diced, optional)",
          },
        },
        required: ["item", "quantity", "unit", "notes"] as const,
        additionalProperties: false,
      },
    },
    steps: {
      type: "array" as const,
      description: "Cooking steps in chronological order",
      items: { type: "string" as const },
    },
  },
  required: ["title", "servings", "cook_time_minutes", "ingredients", "steps"] as const,
  additionalProperties: false,
};

const RETRY_SYSTEM_APPENDIX =
  "Your previous output did not match the required JSON schema. " +
  "You must return valid JSON that strictly conforms to the schema. " +
  "Do not omit required fields. Do not include extra properties. Return only JSON.";

export type RecipeReasoningLog = (message: string, data?: Record<string, unknown>) => void;

export type ExtractRecipeFromVideoOptions = {
  apiKey: string;
  /** Optional logger (e.g. worker log); defaults to no-op */
  log?: RecipeReasoningLog;
};

/**
 * Combine OCR and transcript into a single user message for the model.
 */
function buildUserMessage(ocrText: string, transcriptText: string): string {
  const hasOcr = ocrText.trim().length > 0;
  const hasTranscript = transcriptText.trim().length > 0;
  const parts: string[] = [];

  if (hasOcr) {
    parts.push("## Text from video frames (OCR)\n" + ocrText.trim());
  }
  if (hasTranscript) {
    parts.push("## Spoken narration (transcript)\n" + transcriptText.trim());
  }
  if (parts.length === 0) {
    return "No OCR or transcript content provided.";
  }

  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `You extract a structured recipe from raw text that came from a cooking video.

Sources:
- OCR: text extracted from video frames (often ingredient lists, titles, on-screen text). Prefer OCR for ingredient names, quantities, and measurements.
- Transcript: speech-to-text from the video. Prefer transcript for cooking steps, order of operations, and timing.

Rules:
- Combine both sources intelligently. Do not duplicate information.
- Deduplicate ingredients; merge variants (e.g. "2 cups flour" and "flour" → one line with quantity and unit).
- Normalize units when possible (e.g. tbsp, tsp, cups, g, ml).
- Order cooking steps chronologically.
- Do not invent or assume information that is not present in the input. Use null for unknown servings, cook_time_minutes, or ingredient quantity/unit/notes when not stated.
- Title: infer a short recipe title; use "Untitled Recipe" only if nothing suggests a name.
- Return only valid JSON that matches the exact schema provided.`;

/**
 * Validates parsed object as ExtractedRecipe (shape + types).
 */
function validateExtractedRecipe(raw: unknown): raw is ExtractedRecipe {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;

  if (typeof o.title !== "string") return false;
  if (o.servings !== null && typeof o.servings !== "number") return false;
  if (o.cook_time_minutes !== null && typeof o.cook_time_minutes !== "number") return false;
  if (!Array.isArray(o.ingredients)) return false;
  if (!Array.isArray(o.steps)) return false;

  for (const ing of o.ingredients) {
    if (ing === null || typeof ing !== "object" || Array.isArray(ing)) return false;
    const i = ing as Record<string, unknown>;
    if (typeof i.item !== "string") return false;
    if (i.quantity !== null && typeof i.quantity !== "number") return false;
    if (i.unit !== null && typeof i.unit !== "string") return false;
    if (i.notes !== null && typeof i.notes !== "string") return false;
  }

  for (const step of o.steps) {
    if (typeof step !== "string") return false;
  }

  return true;
}

/**
 * Normalize and type the validated object.
 */
function normalizeExtractedRecipe(raw: ExtractedRecipe): ExtractedRecipe {
  return {
    title: String(raw.title).trim() || "Untitled Recipe",
    servings: raw.servings == null ? null : Number(raw.servings),
    cook_time_minutes: raw.cook_time_minutes == null ? null : Number(raw.cook_time_minutes),
    ingredients: (raw.ingredients || []).map((i: ExtractedRecipeIngredient) => ({
      item: String(i.item).trim(),
      quantity: i.quantity == null ? null : Number(i.quantity),
      unit: i.unit == null ? null : String(i.unit).trim(),
      notes: i.notes == null ? null : String(i.notes).trim(),
    })),
    steps: (raw.steps || []).map((s) => String(s).trim()).filter(Boolean),
  };
}

/**
 * Call OpenAI and parse response; returns null on API/parse/validation failure.
 */
async function callOpenAI(
  openai: OpenAI,
  userContent: string,
  isRetry: boolean,
  log: RecipeReasoningLog
): Promise<{ recipe: ExtractedRecipe; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } | null> {
  const systemContent = isRetry
    ? SYSTEM_PROMPT + "\n\n" + RETRY_SYSTEM_APPENDIX
    : SYSTEM_PROMPT;

  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "extracted_recipe",
        strict: true,
        schema: EXTRACTED_RECIPE_JSON_SCHEMA,
      },
    },
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content?.trim();
  const usage = response.usage
    ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      }
    : undefined;

  if (usage) {
    log("Recipe reasoning token usage", usage);
  }

  if (!content) {
    log("Recipe reasoning: empty response content", { finish_reason: choice?.finish_reason });
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    log("Recipe reasoning: invalid JSON in response", { contentLength: content.length });
    return null;
  }

  if (!validateExtractedRecipe(parsed)) {
    log("Recipe reasoning: response did not match schema");
    return null;
  }

  return { recipe: normalizeExtractedRecipe(parsed as ExtractedRecipe), usage };
}

/**
 * Extract a structured recipe from video OCR text and optional transcript.
 * Uses OPENAI_REASONING_API_KEY (passed in). Returns null on failure or empty input; does not throw.
 */
export async function extractRecipeFromVideo(
  ocrText: string,
  transcriptText: string | null,
  options: ExtractRecipeFromVideoOptions
): Promise<ExtractedRecipe | null> {
  const { apiKey, log: logFn = () => {} } = options;
  const transcript = transcriptText ?? "";
  const userContent = buildUserMessage(ocrText, transcript);

  if (!ocrText.trim() && !transcript.trim()) {
    logFn("Recipe reasoning skipped: no OCR or transcript content");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const result = await callOpenAI(openai, userContent, false, logFn);
    if (result) return result.recipe;

    // Retry once with stricter instruction
    logFn("Recipe reasoning: first attempt failed validation, retrying with stricter instruction");
    const retryResult = await callOpenAI(openai, userContent, true, logFn);
    if (retryResult) return retryResult.recipe;

    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logFn("Recipe reasoning API error", { error: message });
    return null;
  }
}
