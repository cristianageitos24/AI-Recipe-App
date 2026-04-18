import { normalizeIngredientName } from "@/lib/ingredient-normalize";

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** Parse leading number: unicode fraction, "1 1/2", "3/4", decimal. */
function parseLeadingQuantity(tokens: string[]): { qty: number | null; consumed: number } {
  if (tokens.length === 0) return { qty: null, consumed: 0 };

  const t0 = tokens[0];
  if (UNICODE_FRACTIONS[t0] !== undefined) {
    return { qty: UNICODE_FRACTIONS[t0], consumed: 1 };
  }

  const simple = /^(\d+(?:[.,]\d+)?)$/.exec(t0);
  if (simple) {
    const n = parseFloat(simple[1].replace(",", "."));
    if (!Number.isFinite(n)) return { qty: null, consumed: 0 };
    if (tokens.length >= 2) {
      const frac = /^(\d+)\/(\d+)$/.exec(tokens[1]);
      if (frac) {
        const a = parseInt(frac[1], 10);
        const b = parseInt(frac[2], 10);
        if (b > 0) return { qty: n + a / b, consumed: 2 };
      }
    }
    return { qty: n, consumed: 1 };
  }

  const fracOnly = /^(\d+)\/(\d+)$/.exec(t0);
  if (fracOnly) {
    const a = parseInt(fracOnly[1], 10);
    const b = parseInt(fracOnly[2], 10);
    if (b > 0) return { qty: a / b, consumed: 1 };
  }

  return { qty: null, consumed: 0 };
}

const UNIT_ALIASES: Record<string, string> = {
  c: "cup",
  cups: "cup",
  cup: "cup",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  "fl oz": "fl_oz",
  floz: "fl_oz",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  whole: "whole",
  can: "can",
  cans: "can",
  stalk: "stalk",
  stalks: "stalk",
  bunch: "bunch",
  bunches: "bunch",
};

function normalizeUnitToken(raw: string): string | null {
  const u = raw.toLowerCase().trim();
  if (!u) return null;
  if (UNIT_ALIASES[u]) return UNIT_ALIASES[u];
  return null;
}

export type ParsedIngredientLine = {
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  notes: string | null;
};

/**
 * Best-effort parse of a single storage line (from ***-joined ingredient_lines).
 */
export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const raw_text = raw.trim();
  if (!raw_text) {
    return { raw_text, quantity: null, unit: null, item: "", notes: null };
  }

  const parenNotes = raw_text.match(/\(([^)]*)\)\s*$/);
  const notes = parenNotes ? parenNotes[1].trim() || null : null;
  const work = parenNotes ? raw_text.slice(0, parenNotes.index).trim() : raw_text;

  const tokens = work.split(/\s+/).filter(Boolean);
  const { qty, consumed } = parseLeadingQuantity(tokens);
  let idx = consumed;

  let unit: string | null = null;
  if (idx < tokens.length) {
    const t = tokens[idx];
    const maybeTwo = `${t} ${tokens[idx + 1] ?? ""}`.trim().toLowerCase();
    if (maybeTwo === "fl oz" || maybeTwo.startsWith("fl oz")) {
      unit = "fl_oz";
      idx += 2;
    } else {
      const u1 = normalizeUnitToken(t);
      if (u1) {
        unit = u1;
        idx += 1;
      }
    }
  }

  const itemPart = tokens.slice(idx).join(" ").trim();
  const normalized = normalizeIngredientName(itemPart || work);
  const item =
    (itemPart || normalized?.name || work).replace(/\s+/g, " ").trim() || work;

  return {
    raw_text,
    quantity: qty,
    unit,
    item,
    notes,
  };
}
