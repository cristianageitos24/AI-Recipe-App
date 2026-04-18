// App types aligned with Supabase schema and frontend

export type RecipeNutritionSnapshot = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  nutrition_source: "fdc" | "estimated" | "mixed" | "incomplete";
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
  /** Embedded from `recipe_nutrition` when selected (1:1). */
  recipe_nutrition?: RecipeNutritionSnapshot | RecipeNutritionSnapshot[] | null;
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
