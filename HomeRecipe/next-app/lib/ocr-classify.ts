/**
 * Split / classify OCR lines: ingredient-card vs social caption vs junk.
 */

const CAPTION_PATTERNS = [
  /\blink\s+in\s+bio\b/i,
  /\bfollow\s+(me|for)\b/i,
  /\bsave\s+(this|for)\b/i,
  /\bduet\b/i,
  /\bstitch\b/i,
  /\b#\w+/,
  /^@\w+/,
  /\btiktok\b/i,
  /\bcomment\s+(below|your)\b/i,
  /\bsubscribe\b/i,
  /\bwhat('?s| is)\s+for\s+dinner\b/i,
  /\bi\s+(made|ate|tried|love)\b/i,
  /\brecipe\s+in\s+(the\s+)?(comments|caption)\b/i,
];

const MEASURE_HINT =
  /\b(\d+\/\d+|\d+(\.\d+)?|[\u00BC\u00BD\u00BE\u2150-\u215E])\s*(cup|cups|tbsp|tsp|oz|lb|g|kg|ml|l|clove|cloves)?\b/i;

/**
 * True when a line looks like burned-in social caption / promo rather than an ingredient card.
 */
export function looksLikeCaptionLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (CAPTION_PATTERNS.some((p) => p.test(s))) return true;
  // Long sentence without measures → usually caption/narration OCR
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 10 && !MEASURE_HINT.test(s) && /[.!?]/.test(s)) {
    return true;
  }
  if (words.length >= 14 && !MEASURE_HINT.test(s)) {
    return true;
  }
  return false;
}

export type ClassifiedOcr = {
  /** Short noun / measure lines preferred for ingredients */
  ingredientCandidates: string;
  /** Caption / promo / long chatter — model should not treat as ingredients */
  captionNoise: string;
  /** Everything else kept for context */
  other: string;
};

/**
 * Classify cleaned OCR into buckets for the recipe LLM prompt.
 */
export function classifyOcrForRecipe(ocrText: string): ClassifiedOcr {
  const lines = ocrText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const ingredientLike: string[] = [];
  const captions: string[] = [];
  const other: string[] = [];

  const verbStart =
    /^(add|mix|stir|bake|cook|preheat|combine|place|heat|pour|remove|serve|garnish|sprinkle|whisk|simmer|boil|fry|chop|dice|slice|mince|drain|transfer|broil|roast)\b/i;

  for (const line of lines) {
    if (looksLikeCaptionLine(line)) {
      captions.push(line);
      continue;
    }
    const looksMeasure = MEASURE_HINT.test(line) || /\b(pinch|dash)\b/i.test(line);
    const looksStep = verbStart.test(line) || line.length > 80;
    // Short noun phrases / ALL CAPS ingredient labels
    const looksIngredientLabel =
      !looksStep &&
      (looksMeasure ||
        (/^[A-Z][A-Z0-9 .,'%-]{2,40}$/.test(line) && line.split(/\s+/).length <= 6) ||
        (line.split(/\s+/).length <= 5 && !/[.!?]$/.test(line)));

    if (looksIngredientLabel) {
      ingredientLike.push(line);
    } else if (looksStep) {
      other.push(line);
    } else {
      ingredientLike.push(line);
    }
  }

  return {
    ingredientCandidates: ingredientLike.join("\n"),
    captionNoise: captions.join("\n"),
    other: other.join("\n"),
  };
}
