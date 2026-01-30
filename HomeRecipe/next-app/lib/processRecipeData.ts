// Normalize Edamam API recipe to app shape (matches frontend ProcessRecipeData)

export type ProcessedRecipe = {
  recipeID: string;
  calories: number;
  recipeLabel: string;
  cuisineType: string;
  mealType: string;
  timeMin: number;
  ingredients: string;
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

/** Convert ProcessedRecipe to RecipePayload for server actions */
export function toRecipePayload(r: ProcessedRecipe) {
  return {
    recipeID: r.recipeID,
    recipe_label: r.recipeLabel,
    calories: r.calories,
    cuisine_type: r.cuisineType || null,
    meal_type: r.mealType || null,
    time_in_minutes: r.timeMin,
    ingredient_lines: r.ingredients || null,
    website_url: r.websiteURL || null,
    image_url: r.imageURL || null,
  };
}
