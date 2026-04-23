import { URL_IMPORT_DRAFT_ROW_ID } from "@/lib/processRecipeData";
import { formatRecipeEnergyKcalDisplay } from "@/lib/nutrition/nutrition-display";
import { recipeDisplayEnergyKcal } from "@/lib/recipe-select";
import type { RecipeNutritionSnapshot, RecipeRow } from "@/lib/types";

/** One ingredient row for the universal recipe template (display). */
export type RecipeTemplateIngredientLine = {
  lineIndex: number;
  rawText: string;
  displayName: string;
  displayQuantity: string;
};

export type RecipeTemplateStep = {
  index: number;
  text: string;
};

export type RecipeTemplateNutrition = {
  caloriesDisplay: string;
  caloriesTitle?: string;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  nutritionSource: "fdc" | "estimated" | "mixed" | "incomplete";
};

export type RecipeTemplateTimes = {
  prepMinutes: number | null;
  cookMinutes: number;
  totalMinutes: number;
};

export type RecipeTemplateMetadata = {
  cuisine: string | null;
  mealType: string | null;
  difficulty: string | null;
  sourceUrl: string | null;
  creatorLine: string | null;
  sourceLine: string | null;
  yieldsLabel: string | null;
};

/**
 * View model for the universal recipe template — all recipe sources map here via
 * `buildRecipeTemplateData`.
 */
export type RecipeTemplateData = {
  rowId: string;
  recipeId: string;
  title: string;
  imageUrl: string | null;
  description: string | null;
  creatorLine: string | null;
  sourceLine: string | null;
  times: RecipeTemplateTimes;
  servingsDisplay: string | null;
  ingredients: RecipeTemplateIngredientLine[];
  steps: RecipeTemplateStep[];
  nutrition: RecipeTemplateNutrition;
  metadata: RecipeTemplateMetadata;
  /** URL-import preview before save — server actions that need a real recipe UUID must skip. */
  isDraftImport: boolean;
};

function pickNutritionSnapshot(row: RecipeRow): RecipeNutritionSnapshot | null {
  const raw = row.recipe_nutrition;
  if (!raw) return null;
  const n = Array.isArray(raw) ? raw[0] : raw;
  if (!n || typeof n !== "object") return null;
  return n as RecipeNutritionSnapshot;
}

/**
 * Split free-text ingredient lines for mock-style name (left) + quantity (right).
 * Best-effort; falls back to full text as name when no leading quantity is detected.
 */
export function splitIngredientLineForTemplate(raw: string): {
  displayName: string;
  displayQuantity: string;
} {
  const t = raw.trim();
  if (!t) return { displayName: "", displayQuantity: "" };

  const qtyFirst = t.match(
    /^((?:\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)(?:\s*[-–]\s*\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)?(?:\s*(?:g|kg|mg|ml|mL|oz|lb|lbs|cups?|cup|tbsp|tsp|Tbsp|tsp\.|cloves?|medium|large|small|pinch))?\s+)(.+)$/i
  );
  if (qtyFirst) {
    return {
      displayQuantity: qtyFirst[1].trim(),
      displayName: qtyFirst[2].trim(),
    };
  }

  const parenQty = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenQty) {
    return { displayName: parenQty[1].trim(), displayQuantity: parenQty[2].trim() };
  }

  return { displayName: t, displayQuantity: "" };
}

function capitalizeWords(s: string): string {
  if (s.includes("/")) {
    return s.replace(/\/(.)/g, (_, c: string) => `/${c.toUpperCase()}`);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferSourceFromUrl(url: string | null): {
  sourceLine: string | null;
  creatorLine: string | null;
} {
  if (!url?.trim()) return { sourceLine: null, creatorLine: null };
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    let creator: string | null = null;
    const tik = u.pathname.match(/@([^/]+)/);
    if (tik) creator = `@${tik[1]}`;

    let label = "Recipe";
    if (host.includes("tiktok")) label = "Recipe on TikTok";
    else if (host.includes("instagram")) label = "Recipe on Instagram";
    else if (host.includes("youtube") || host.includes("youtu.be")) label = "Recipe on YouTube";
    else label = `Recipe on ${host.split(".")[0]}`;

    const sourceLine = creator ? `${creator} · ${label}` : label;
    return { sourceLine, creatorLine: creator };
  } catch {
    return { sourceLine: "Recipe link", creatorLine: null };
  }
}

export function isRecipeTemplateDraftRow(row: Pick<RecipeRow, "id">): boolean {
  return row.id === URL_IMPORT_DRAFT_ROW_ID;
}

/**
 * Build the universal template view model from any persisted or draft `RecipeRow`.
 */
export function buildRecipeTemplateData(row: RecipeRow): RecipeTemplateData {
  const rawIngredients = (row.ingredient_lines ?? "")
    .split("***")
    .map((s) => s.trim())
    .filter(Boolean);
  const ingredients: RecipeTemplateIngredientLine[] = rawIngredients.map((rawText, lineIndex) => {
    const { displayName, displayQuantity } = splitIngredientLineForTemplate(rawText);
    return { lineIndex, rawText, displayName, displayQuantity };
  });

  const steps: RecipeTemplateStep[] = (row.steps ?? "")
    .trim()
    ? (row.steps ?? "")
        .split("***")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text, i) => ({ index: i, text }))
    : [];

  const cookMinutes = row.time_in_minutes < 1 ? 1 : row.time_in_minutes;
  const snap = pickNutritionSnapshot(row);
  const energy = formatRecipeEnergyKcalDisplay(row);

  const nutrition: RecipeTemplateNutrition = {
    caloriesDisplay: energy.kcalText,
    caloriesTitle: energy.title,
    proteinG: snap ? Number(snap.protein_g) : null,
    fatG: snap ? Number(snap.fat_g) : null,
    carbG: snap ? Number(snap.carb_g) : null,
    fiberG: null,
    sugarG: null,
    nutritionSource: snap?.nutrition_source ?? "incomplete",
  };

  const inferred = inferSourceFromUrl(row.website_url?.trim() ?? null);

  const servingsNum =
    snap && snap.servings != null && Number.isFinite(Number(snap.servings))
      ? Number(snap.servings)
      : null;
  const yieldsFromMeal = row.meal_type?.trim() || null;
  const servingsDisplay =
    servingsNum != null
      ? servingsNum === Math.floor(servingsNum)
        ? String(Math.round(servingsNum))
        : String(servingsNum)
      : yieldsFromMeal;

  const meta: RecipeTemplateMetadata = {
    cuisine: row.cuisine_type?.trim() ? capitalizeWords(row.cuisine_type.trim()) : null,
    mealType: row.meal_type?.trim() ? capitalizeWords(row.meal_type.trim()) : null,
    difficulty: null,
    sourceUrl: row.website_url?.trim() ?? null,
    creatorLine: inferred.creatorLine,
    sourceLine: inferred.sourceLine,
    yieldsLabel: yieldsFromMeal,
  };

  return {
    rowId: row.id,
    recipeId: row.recipe_id,
    title: row.recipe_label,
    imageUrl: row.image_url?.trim() || null,
    description: null,
    creatorLine: meta.creatorLine,
    sourceLine: meta.sourceLine,
    times: {
      prepMinutes: null,
      cookMinutes,
      totalMinutes: cookMinutes,
    },
    servingsDisplay,
    ingredients,
    steps,
    nutrition,
    metadata: meta,
    isDraftImport: isRecipeTemplateDraftRow(row),
  };
}

/** Kcal for stat card — consistent with list cards. */
export function recipeTemplateStatCalories(row: RecipeRow): number {
  return recipeDisplayEnergyKcal(row);
}
