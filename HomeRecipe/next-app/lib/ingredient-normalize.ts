// Shared normalization for "raw" ingredient names.
// Converts free-form ingredient text like "3/4 tablespoon paprika (optional)"
// into a canonical search key and display name:
//   search_name: "paprika"
//   name:        "Paprika"

export type NormalizedIngredientName = {
  search_name: string;
  name: string;
};

// Common unicode fraction characters we want to strip when they appear at the start
const UNICODE_FRACTIONS = "¼½¾⅓⅔⅛⅜⅝⅞";

// Patterns that clearly indicate this is not a single ingredient name
const NON_INGREDIENT_PREFIXES = [
  "optional:",
  "optionally",
  "note:",
  "notes:",
  "available at",
  "smoked paprika is available",
];

// Words/phrases that, when they appear at the start, usually mean instruction text
const INSTRUCTION_START_PATTERNS = [
  /^add\s+/,
  /^mix\s+/,
  /^stir\s+/,
  /^bake\s+/,
  /^cook\s+/,
  /^preheat\s+/,
  /^combine\s+/,
  /^place\s+/,
  /^heat\s+/,
  /^pour\s+/,
  /^remove\s+/,
  /^serve\s+/,
];

// Trailing phrases we strip off to get down to the core ingredient
const TRAILING_FLUFF_PATTERNS = [
  /\boptional\b.*$/i,
  /\bto\s+taste\b.*$/i,
  /\bfor\s+garnish\b.*$/i,
  /\bfor\s+serving\b.*$/i,
];

function capitalizeWords(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripLeadingPunctuation(s: string): string {
  return s.replace(/^[\s,.;:()\-\u2013\u2014]+/, "");
}

function stripParentheticalPhrases(s: string): string {
  // Remove short parenthetical notes, but leave the surrounding ingredient name.
  // Example: "paprika (optional)" -> "paprika"
  return s.replace(/\([^)]*\)/g, " ");
}

function stripLeadingQuantityAndUnit(s: string): string {
  let result = s;

  // Unicode fraction alone, optionally followed by unit
  const unicodeFractionRegex = new RegExp(
    `^[${UNICODE_FRACTIONS}]\\s*(?:cup|cups|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|ml|milliliter|milliliters|l|liter|liters|pinch|pinches|dash|dashes|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|bag|bags|bunch|bunches)?\\s*(?:of)?\\s*`,
    "i"
  );

  // Numeric amounts like "1", "1.5", "1 1/2", "3/4", with unit
  const numericAmountWithUnit =
    /^(?:\d+\s*\d*\/\d+|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)\s*(?:cup|cups|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|ml|milliliter|milliliters|l|liter|liters|pinch|pinches|dash|dashes|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|bag|bags|bunch|bunches)?\s*(?:of)?\s*/i;

  // Standalone unit phrases like "a pinch of", "pinch of", "dash of"
  const unitOnly =
    /^(?:a\s+)?(?:pinch|pinches|dash|dashes|handful|sprinkle)\s*(?:of)?\s*/i;

  // Apply all patterns once (they only match at the start)
  result = result.replace(unicodeFractionRegex, "");
  result = result.replace(numericAmountWithUnit, "");
  result = result.replace(unitOnly, "");

  return result;
}

export function normalizeIngredientName(
  raw: string
): NormalizedIngredientName | null {
  if (!raw) return null;

  let s = raw.trim();
  if (!s || s.length < 2) return null;

  // Early exit for obviously non-ingredient prefixes
  const lower = s.toLowerCase();
  if (NON_INGREDIENT_PREFIXES.some((p) => lower.startsWith(p))) {
    return null;
  }

  if (INSTRUCTION_START_PATTERNS.some((re) => re.test(lower))) {
    return null;
  }

  // Strip obvious leading punctuation and quantity/unit
  s = stripLeadingPunctuation(s);
  s = stripLeadingQuantityAndUnit(s);

  // Strip short parenthetical notes "(optional)", "(diced)" etc.
  s = stripParentheticalPhrases(s);

  // Strip trailing fluff phrases we don't want in the canonical name
  for (const pattern of TRAILING_FLUFF_PATTERNS) {
    s = s.replace(pattern, "");
  }

  // Collapse spaces and trim again
  s = s.replace(/\s+/g, " ").trim();

  if (!s || s.length < 2) return null;

  // If it looks like a full sentence, don't treat it as a raw ingredient
  if (/[.!?]/.test(s)) {
    return null;
  }

  const words = s.split(/\s+/);
  if (words.length > 10) {
    // Very long text is unlikely to be a single ingredient
    return null;
  }

  const search_name = s.toLowerCase();
  const name = capitalizeWords(search_name);

  return { search_name, name };
}

