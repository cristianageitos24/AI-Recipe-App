/**
 * Multimodal vision inventory: foods and on-screen ingredient labels from color frames.
 * Non-fatal when called with timeouts; feature-flagged via VISION_LLM_ENABLED.
 */

import { readFile } from "fs/promises";
import OpenAI from "openai";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

export type VisionIngredientHint = {
  item: string;
  source: "label" | "visible_food" | "uncertain";
  notes?: string | null;
};

export type VisionInventoryResult = {
  titleHint: string | null;
  ingredients: VisionIngredientHint[];
  rawTextLabels: string[];
  model: string;
  ms: number;
};

const INVENTORY_SCHEMA = {
  type: "object" as const,
  properties: {
    title_hint: { type: ["string", "null"] as const },
    ingredients: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          item: { type: "string" as const },
          source: {
            type: "string" as const,
            enum: ["label", "visible_food", "uncertain"],
          },
          notes: { type: ["string", "null"] as const },
        },
        required: ["item", "source", "notes"] as const,
        additionalProperties: false,
      },
    },
    raw_text_labels: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["title_hint", "ingredients", "raw_text_labels"] as const,
  additionalProperties: false,
};

const SYSTEM = `You look at frames from a cooking video.
List real food ingredients that are clearly shown as food OR clearly labeled on screen (e.g. "chicken breast", "sweet paprika").
Ignore TikTok UI, watermarks, @handles, hashtags, and promotional captions.
Do not invent spices or pantry items that are not clearly visible or labeled.
Prefer short ingredient names (noun phrases). quantity unknown is fine — omit amounts.
source=label when reading on-screen text; source=visible_food when you see the food; uncertain if unsure.`;

export async function inventoryIngredientsFromColorFrames(options: {
  framePaths: string[];
  apiKey: string;
  model: string;
  timeoutMs: number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}): Promise<VisionInventoryResult | null> {
  const { framePaths, apiKey, model, timeoutMs, log = () => {} } = options;
  if (framePaths.length === 0) return null;

  const t0 = Date.now();
  const openai = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text:
        "These frames are from one cooking video (in time order). Return JSON of foods/labels only.",
    },
  ];

  for (const path of framePaths) {
    try {
      const buf = await readFile(path);
      const b64 = buf.toString("base64");
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${b64}`,
          detail: "low",
        },
      });
    } catch (e) {
      log("Vision LLM: failed to read frame", {
        path,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (content.length < 2) return null;

  try {
    const response = await withTimeout(
      openai.chat.completions.create({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vision_ingredient_inventory",
            strict: true,
            schema: INVENTORY_SCHEMA,
          },
        },
      }),
      timeoutMs,
      `Vision LLM exceeded timeout of ${timeoutMs}ms`
    );

    const raw = response.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      log("Vision LLM: empty content");
      return null;
    }

    const parsed = JSON.parse(raw) as {
      title_hint: string | null;
      ingredients: Array<{
        item: string;
        source: "label" | "visible_food" | "uncertain";
        notes: string | null;
      }>;
      raw_text_labels: string[];
    };

    const ingredients: VisionIngredientHint[] = (parsed.ingredients || [])
      .map((i) => ({
        item: String(i.item || "").trim(),
        source: i.source,
        notes: i.notes,
      }))
      .filter((i) => i.item.length > 0);

    const result: VisionInventoryResult = {
      titleHint: parsed.title_hint?.trim() || null,
      ingredients,
      rawTextLabels: (parsed.raw_text_labels || [])
        .map((s) => String(s).trim())
        .filter(Boolean),
      model,
      ms: Date.now() - t0,
    };
    log("Vision LLM inventory complete", {
      count: result.ingredients.length,
      ms: result.ms,
      model,
    });
    return result;
  } catch (err) {
    log("Vision LLM failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Format inventory for the recipe-reasoning user message. */
export function formatVisionInventoryForPrompt(
  inventory: VisionInventoryResult | null
): string {
  if (!inventory || inventory.ingredients.length === 0) {
    return "";
  }
  const lines = inventory.ingredients.map((i) => {
    const note = i.notes ? ` (${i.notes})` : "";
    return `- ${i.item}${note} [${i.source}]`;
  });
  const labels =
    inventory.rawTextLabels.length > 0
      ? `\nOn-screen text snippets:\n${inventory.rawTextLabels.map((t) => `- ${t}`).join("\n")}`
      : "";
  const title = inventory.titleHint
    ? `Title hint: ${inventory.titleHint}\n`
    : "";
  return (
    "## Vision inventory (foods / labels seen in color frames)\n" +
    title +
    lines.join("\n") +
    labels +
    "\n\nRules for this section: include clearly labeled or clearly visible foods even without quantities. " +
    "Do not invent spices from this section alone. OCR measurements win when amounts conflict."
  );
}
