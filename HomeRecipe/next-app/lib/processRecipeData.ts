// Normalize Edamam API recipe to app shape (matches frontend ProcessRecipeData)

import { v4 as uuidv4 } from "uuid";
import type {
  ExtractedRecipe,
  ExtractedRecipeIngredient,
  RecipePayload,
  RecipeRow,
} from "./types";

export type ProcessedRecipe = {
  recipeID: string;
  calories: number;
  recipeLabel: string;
  cuisineType: string;
  mealType: string;
  timeMin: number;
  ingredients: string;
  steps?: string | null;
  imageURL: string;
  websiteURL: string;
};

type EdamamRecipe = {
  label?: string | null;
  calories?: number | null;
  cuisineType?: string[] | null;
  mealType?: string[] | null;
  totalTime?: number | null;
  ingredientLines?: string[] | null;
  url?: string | null;
  images?: {
    LARGE?: { url?: string };
    REGULAR?: { url?: string };
    SMALL?: { url?: string };
  };
};

function generateHashKey(inputString: string): string {
  const index = inputString.indexOf("?X-Amz-Security-Token");
  const cleanedUrl = index !== -1 ? inputString.substring(0, index) : inputString;
  let hash = 0;
  if (cleanedUrl.length === 0) return hash.toString();
  for (let i = 0; i < cleanedUrl.length; i++) {
    const char = cleanedUrl.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function getImageURL(apiURL: EdamamRecipe["images"]): string {
  if (apiURL?.LARGE?.url) return apiURL.LARGE.url;
  if (apiURL?.REGULAR?.url) return apiURL.REGULAR.url;
  if (apiURL?.SMALL?.url) return apiURL.SMALL.url;
  return "";
}

function formatCalories(calories: number): number {
  const n = parseFloat(String(calories));
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

export function processRecipeData(recipeData: EdamamRecipe | null): ProcessedRecipe {
  const data: ProcessedRecipe = {
    recipeID: "0",
    calories: 0,
    recipeLabel: "",
    cuisineType: "",
    mealType: "",
    timeMin: 0,
    ingredients: "",
    imageURL: "",
    websiteURL: "",
  };
  if (!recipeData) return data;

  data.imageURL = getImageURL(recipeData.images);
  data.recipeID = generateHashKey(data.imageURL);
  if (recipeData.calories != null) data.calories = formatCalories(recipeData.calories);
  if (recipeData.label != null) data.recipeLabel = recipeData.label;
  if (recipeData.cuisineType?.[0] != null) data.cuisineType = recipeData.cuisineType[0];
  if (recipeData.mealType?.[0] != null) data.mealType = recipeData.mealType[0];
  if (recipeData.totalTime != null) data.timeMin = recipeData.totalTime;
  if (recipeData.ingredientLines != null) data.ingredients = recipeData.ingredientLines.join("***");
  if (recipeData.url != null) data.websiteURL = recipeData.url;
  return data;
}

/** Convert RecipeRow (from Supabase) to ProcessedRecipe for components */
export function recipeRowToProcessed(r: RecipeRow): ProcessedRecipe {
  return {
    recipeID: r.recipe_id,
    recipeLabel: r.recipe_label,
    calories: r.calories,
    cuisineType: r.cuisine_type ?? "",
    mealType: r.meal_type ?? "",
    timeMin: r.time_in_minutes,
    ingredients: r.ingredient_lines ?? "",
    imageURL: r.image_url ?? "",
    websiteURL: r.website_url ?? "",
  };
}

/** Convert ProcessedRecipe to RecipePayload for server actions */
export function toRecipePayload(r: ProcessedRecipe): RecipePayload {
  return {
    recipeID: r.recipeID,
    recipe_label: r.recipeLabel,
    calories: r.calories,
    cuisine_type: r.cuisineType || null,
    meal_type: r.mealType || null,
    time_in_minutes: r.timeMin,
    ingredient_lines: r.ingredients || null,
    steps: r.steps ?? null,
    website_url: r.websiteURL || null,
    image_url: r.imageURL || null,
  };
}

/** Normalize newline-separated text to ***-joined lines */
function linesToStorage(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.join("***");
}

/** Build RecipePayload from manual entry form (no Edamam). */
export function buildManualRecipePayload(params: {
  recipeLabel: string;
  ingredientsText: string;
  stepsText?: string;
  timeInMinutes: number;
  calories?: number;
  cuisineType?: string;
  mealType?: string;
  imageUrl?: string;
  websiteUrl?: string;
}): RecipePayload {
  const recipeID = `manual-${uuidv4()}`;
  const ingredient_lines = linesToStorage(params.ingredientsText);
  const steps = params.stepsText?.trim() ? linesToStorage(params.stepsText) : null;
  const time = Number(params.timeInMinutes);
  const time_in_minutes = Number.isFinite(time) && time >= 0 ? time : 0;
  const cal = params.calories != null ? Number(params.calories) : 0;
  const calories = Number.isFinite(cal) && cal >= 0 ? cal : 0;

  return {
    recipeID,
    recipe_label: params.recipeLabel.trim(),
    calories,
    cuisine_type: params.cuisineType?.trim() || null,
    meal_type: params.mealType?.trim() || null,
    time_in_minutes,
    ingredient_lines: ingredient_lines || null,
    steps,
    website_url: params.websiteUrl?.trim() || null,
    image_url: params.imageUrl?.trim() || null,
  };
}

/** Format a single extracted ingredient as a display/storage line */
function formatIngredientLine(ing: ExtractedRecipeIngredient): string {
  const parts: string[] = [];
  if (ing.quantity != null) parts.push(String(ing.quantity));
  if (ing.unit?.trim()) parts.push(ing.unit.trim());
  parts.push(ing.item.trim());
  if (ing.notes?.trim()) parts.push(ing.notes.trim());
  return parts.join(" ");
}

/**
 * Convert ExtractedRecipe (from video job) to RecipePayload for getOrCreateRecipe / addRecipeToFolder.
 * Use a stable recipe_id so the same video job always maps to the same recipe row.
 */
export function extractedRecipeToPayload(
  extracted: ExtractedRecipe,
  jobId: string
): RecipePayload {
  const recipe_id = `video-recipe-${jobId}`;
  const ingredient_lines =
    extracted.ingredients.length > 0
      ? extracted.ingredients.map(formatIngredientLine).join("***")
      : null;
  const steps =
    extracted.steps.length > 0 ? extracted.steps.join("***") : null;
  return {
    recipeID: recipe_id,
    recipe_label: extracted.title.trim() || "Untitled Recipe",
    calories: 0,
    cuisine_type: null,
    meal_type: null,
    time_in_minutes: extracted.cook_time_minutes ?? 0,
    ingredient_lines,
    steps,
    website_url: null,
    image_url: null,
  };
}

/**
 * Build RecipePayload from the user's edited recipe state (video upload flow).
 * Use when saving after the user has edited title, ingredients, cook time, or steps.
 */
export function buildVideoRecipePayload(
  edited: {
    title: string;
    ingredientLines: string[];
    cookTimeMinutes: number;
    steps: string[];
  },
  jobId: string,
  options?: {
    sourceUrl?: string | null;
  }
): RecipePayload {
  const recipe_id = `video-recipe-${jobId}`;
  const ingredient_lines =
    edited.ingredientLines.length > 0
      ? edited.ingredientLines
          .map((s) => s.trim())
          .filter(Boolean)
          .join("***")
      : null;
  const steps =
    edited.steps.length > 0
      ? edited.steps
          .map((s) => s.trim())
          .filter(Boolean)
          .join("***")
      : null;
  const time = Number(edited.cookTimeMinutes);
  const time_in_minutes =
    Number.isFinite(time) && time >= 0 ? time : 0;
  return {
    recipeID: recipe_id,
    recipe_label: edited.title.trim() || "Untitled Recipe",
    calories: 0,
    cuisine_type: null,
    meal_type: null,
    time_in_minutes,
    ingredient_lines,
    steps,
    website_url: options?.sourceUrl?.trim() || null,
    image_url: null,
  };
}
