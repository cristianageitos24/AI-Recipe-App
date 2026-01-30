// App types aligned with Supabase schema and frontend

export type RecipeRow = {
  id: string;
  recipe_id: string;
  recipe_label: string;
  calories: number;
  cuisine_type: string | null;
  meal_type: string | null;
  time_in_minutes: number;
  ingredient_lines: string | null;
  website_url: string | null;
  image_url: string | null;
  created_at?: string;
};

export type RecipePayload = {
  recipeID: string;
  recipe_label: string;
  calories: number;
  cuisine_type: string | null;
  meal_type: string | null;
  time_in_minutes: number;
  ingredient_lines: string | null;
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
