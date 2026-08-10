// App types aligned with Supabase schema and frontend

export type RecipeNutritionSnapshot = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  nutrition_source: "fdc" | "estimated" | "mixed" | "incomplete";
  /** From `recipe_nutrition.servings` when selected; optional on older rows. */
  servings?: number | null;
};

/** Per-line nutrition provenance from `recipe_ingredient_lines` (embedded select). */
export type FdcCandidateSnapshot = {
  fdc_id: number;
  description: string;
  score: number;
};

export type RecipeIngredientLineSnapshot = {
  line_index: number;
  item: string | null;
  raw_text: string | null;
  line_nutrition_source: "fdc" | "estimated" | "unresolved";
  fdc_id: number | null;
  estimation_reason: string | null;
  /** Present when resolution was ambiguous (user should pick a USDA food). */
  fdc_candidates?: FdcCandidateSnapshot[] | null;
};

export type RecipeRow = {
  id: string;
  recipe_id: string;
  recipe_label: string;
  calories: number;
  cuisine_type: string | null;
  meal_type: string | null;
  time_in_minutes: number;
  ingredient_lines: string | null;
  steps: string | null;
  website_url: string | null;
  image_url: string | null;
  created_at?: string;
  /** Soft-delete timestamp when in trash. */
  deleted_at?: string | null;
  /** Owner Clerk user id; null = shared catalog. */
  user_id?: string | null;
  /** Free-tier expiry; null = permanent (Pro or shared). */
  expires_at?: string | null;
  /** Embedded from `recipe_nutrition` when selected (1:1). */
  recipe_nutrition?: RecipeNutritionSnapshot | RecipeNutritionSnapshot[] | null;
  /** Populated when the query embeds `recipe_ingredient_lines` (nutrition sync). */
  recipe_ingredient_lines?: RecipeIngredientLineSnapshot[] | null;
};

export type RecipePayload = {
  recipeID: string;
  recipe_label: string;
  calories: number;
  cuisine_type: string | null;
  meal_type: string | null;
  time_in_minutes: number;
  ingredient_lines: string | null;
  steps: string | null;
  website_url: string | null;
  image_url: string | null;
  /**
   * When set (e.g. video extract), persist these instead of relying on a post-save
   * FDC re-sync that can time out on Vercel and leave macros empty.
   */
  recipe_nutrition?: RecipeNutritionSnapshot | null;
  recipe_ingredient_lines?: RecipeIngredientLineSnapshot[] | null;
};

export type FolderRow = {
  id: string;
  user_id: string;
  folder_name: string;
};

export type MealDateRow = {
  id: string;
  user_id: string;
  event_id: string;
  date: string;
  created_at?: string;
};

export type MealDateWithRecipe = MealDateRow & {
  recipe_id: string;
  recipe?: RecipeRow;
};

/** Single ingredient from AI-extracted recipe (video pipeline) */
export type ExtractedRecipeIngredient = {
  item: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
};

/** Structured recipe extracted from video OCR + transcript (AI reasoning) */
export type ExtractedRecipe = {
  title: string;
  servings: number | null;
  cook_time_minutes: number | null;
  ingredients: ExtractedRecipeIngredient[];
  steps: string[];
  /** Filled by the video worker via the same resolver used after save (FDC + AI). */
  recipe_nutrition?: RecipeNutritionSnapshot | null;
  recipe_ingredient_lines?: RecipeIngredientLineSnapshot[] | null;
};

/** JSON returned by the static URL recipe import service (`/api/recipes/import-url`) */
export type UrlImportedRecipe = {
  source_url: string;
  title: string | null;
  image: string | null;
  ingredients: string[];
  instructions: string | null;
  instructions_list: string[];
  cooktime_minutes: number | null;
  prep_time_minutes: number | null;
  total_time_minutes: number | null;
  calories: string | null;
  yields: string | null;
};

/** Normalized web result returned by Tavily search. */
export type WebRecipeSearchResult = {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string | null;
  image: string | null;
};
