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
      description:
        "Deduplicated ingredient list. Each entry must represent ONE raw ingredient (a noun phrase like 'paprika' or 'red onion') with optional quantity/unit/short notes. Never include instructions or full sentences here.",
      items: {
        type: "object" as const,
        properties: {
          item: {
            type: "string" as const,
            description:
              "Single ingredient name only (a noun or short noun phrase). No verbs, instructions, or sentences. Examples: 'paprika', 'red onion', 'olive oil'. Do NOT write things like 'add the paprika and stir' or 'onion sautéed with garlic'.",
          },
          quantity: {
            type: ["number", "null"] as const,
            description: "Numeric quantity, or null if not clearly given.",
          },
          unit: {
            type: ["string", "null"] as const,
            description:
              "Unit (e.g. cups, tbsp, tsp, g, ml), or null if not clearly given.",
          },
          notes: {
            type: ["string", "null"] as const,
            description:
              "Optional very short descriptor only (e.g. 'diced', 'minced', 'optional'). No verbs, instructions, or multi-step text.",
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
 * Splits OCR into ingredient-like vs instruction-like lines heuristically for clearer reasoning.
 */
function buildUserMessage(ocrText: string, transcriptText: string): string {
  const hasOcr = ocrText.trim().length > 0;
  const hasTranscript = transcriptText.trim().length > 0;
  const parts: string[] = [];

  if (hasOcr) {
    const raw = ocrText.trim();
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const ingredientLike: string[] = [];
    const instructionLike: string[] = [];
    const verbStart =
      /^(add|mix|stir|bake|cook|preheat|combine|place|heat|pour|remove|serve|garnish|sprinkle|whisk|simmer|boil|fry|chop|dice|slice|mince|drain|transfer|bake|broil|roast)\b/i;

    for (const line of lines) {
      const looksMeasure =
        /\b(\d+\/\d+|\d+(\.\d+)?)\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l|clove|cloves)\b/i.test(
          line
        );
      const looksStep = verbStart.test(line) || line.length > 80;
      if (looksMeasure && !looksStep) {
        ingredientLike.push(line);
      } else if (looksStep) {
        instructionLike.push(line);
      } else {
        ingredientLike.push(line);
      }
    }

    if (ingredientLike.length === 0 && instructionLike.length === 0) {
      parts.push("## Text from video frames (OCR)\n" + raw);
    } else {
      parts.push(
        "## Ingredient candidates (from on-screen OCR)\n" +
          (ingredientLike.length > 0
            ? ingredientLike.join("\n")
            : "(none clearly separated)")
      );
      parts.push(
        "## Instruction candidates (from on-screen OCR)\n" +
          (instructionLike.length > 0
            ? instructionLike.join("\n")
            : "(none clearly separated)")
      );
    }
  }

  if (hasTranscript) {
    parts.push("## Transcript (spoken narration)\n" + transcriptText.trim());
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
- Ingredients vs steps:
  - Each ingredient "item" must be ONLY the ingredient name (a noun or short noun phrase), never a sentence or instruction.
  - Examples of valid items: "paprika", "red onion", "olive oil".
  - Examples of INVALID items (do NOT output these in ingredients): "add the paprika and stir", "onion sautéed with garlic", "smoked paprika is available at most supermarkets".
  - Put all actions, preparation, and order of operations in "steps".
  - Use ingredient "notes" only for very short descriptors like "diced" or "optional", never for verbs or instructions.
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
function isStepLikeText(text: string | null | undefined): boolean {
  if (!text) return false;
  const s = String(text).trim();
  if (!s) return false;

  const lower = s.toLowerCase();
  // Obvious sentence markers or long text with verbs look like steps
  if (/[.!?]/.test(s)) return true;

  const verbPatterns =
    /\b(add|mix|stir|bake|cook|preheat|combine|place|heat|pour|remove|serve|garnish|sprinkle|whisk|simmer|boil|fry|saute|sauté)\b/;
  const words = lower.split(/\s+/);

  if (words.length > 10 && verbPatterns.test(lower)) {
    return true;
  }

  return false;
}

function normalizeExtractedRecipe(raw: ExtractedRecipe): ExtractedRecipe {
  const normalizedIngredients: ExtractedRecipeIngredient[] = [];
  const extraSteps: string[] = [];

  for (const ing of raw.ingredients || []) {
    const item = String(ing.item ?? "").trim();
    const quantity =
      ing.quantity == null ? null : Number(ing.quantity);
    const unit =
      ing.unit == null ? null : String(ing.unit).trim() || null;
    const notes =
      ing.notes == null ? null : String(ing.notes).trim() || null;

    // If the model accidentally put a step-like sentence into ingredients,
    // move it into steps instead of treating it as an ingredient.
    if (isStepLikeText(item) || isStepLikeText(notes)) {
      const combined = [item, notes].filter(Boolean).join(" - ");
      if (combined) {
        extraSteps.push(combined);
      }
      continue;
    }

    if (!item) continue;

    normalizedIngredients.push({
      item,
      quantity,
      unit,
      notes,
    });
  }

  const normalizedSteps = (raw.steps || [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  return {
    title: String(raw.title).trim() || "Untitled Recipe",
    servings: raw.servings == null ? null : Number(raw.servings),
    cook_time_minutes:
      raw.cook_time_minutes == null ? null : Number(raw.cook_time_minutes),
    ingredients: normalizedIngredients,
    steps: [...normalizedSteps, ...extraSteps],
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
