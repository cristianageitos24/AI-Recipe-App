/**
 * Import TheMealDB recipes into public.recipes as shared catalog rows.
 *
 * Run: npm run import:mealdb
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 * MealDB rows are inserted with user_id = null so all authenticated users can
 * read them through the existing shared-catalog RLS policy.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

const MEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1/search.php";
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const BATCH_SIZE = 100;

type MealDbMeal = {
  idMeal?: string | null;
  strMeal?: string | null;
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
} & Record<`strIngredient${number}` | `strMeasure${number}`, string | null | undefined>;

type MealDbResponse = {
  meals: MealDbMeal[] | null;
};

type RecipeInsert = {
  recipe_id: string;
  recipe_label: string;
  calories: number;
  cuisine_type: string | null;
  meal_type: string | null;
  time_in_minutes: number;
  ingredient_lines: string | null;
  steps: string | null;
  website_url: string;
  image_url: string | null;
  user_id: null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function mealDbSourceUrl(idMeal: string): string {
  return `https://www.themealdb.com/meal/${encodeURIComponent(idMeal)}`;
}

function mapIngredients(meal: MealDbMeal): string | null {
  const lines: string[] = [];

  for (let index = 1; index <= 20; index++) {
    const ingredient = clean(meal[`strIngredient${index}`]);
    if (!ingredient) continue;

    const measure = clean(meal[`strMeasure${index}`]);
    lines.push([measure, ingredient].filter(Boolean).join(" "));
  }

  return lines.length > 0 ? lines.join("***") : null;
}

function mapSteps(instructions: string | null | undefined): string | null {
  const lines = clean(instructions)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .map((line) => {
      if (/^(?:step\s*)?\d+\s*[:.)-]?$/i.test(line)) return "";
      return line.replace(/^step\s*\d+\s*[:.)-]\s+/i, "").trim();
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join("***") : null;
}

function mapMealToRecipe(meal: MealDbMeal): RecipeInsert | null {
  const idMeal = clean(meal.idMeal);
  const label = clean(meal.strMeal);

  if (!idMeal || !label) return null;

  return {
    recipe_id: `mealdb-${idMeal}`,
    recipe_label: label,
    calories: 0,
    cuisine_type: clean(meal.strArea) || null,
    meal_type: clean(meal.strCategory) || null,
    time_in_minutes: 0,
    ingredient_lines: mapIngredients(meal),
    steps: mapSteps(meal.strInstructions),
    website_url: mealDbSourceUrl(idMeal),
    image_url: clean(meal.strMealThumb) || null,
    user_id: null,
  };
}

async function fetchMealsByLetter(letter: string): Promise<MealDbMeal[]> {
  const url = new URL(MEALDB_BASE_URL);
  url.searchParams.set("f", letter);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MealDB ${letter} request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as MealDbResponse;
  return data.meals ?? [];
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const seenRecipeIds = new Set<string>();
  let batch: RecipeInsert[] = [];
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;

  async function flushBatch() {
    if (batch.length === 0) return;

    const rows = batch;
    batch = [];

    const { error } = await supabase
      .from("recipes")
      .upsert(rows, { onConflict: "recipe_id", ignoreDuplicates: false });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    upserted += rows.length;
    console.log(`Upserted ${upserted} recipes...`);
  }

  for (const letter of LETTERS) {
    console.log(`Fetching MealDB recipes for "${letter}"...`);
    const meals = await fetchMealsByLetter(letter);
    fetched += meals.length;

    for (const meal of meals) {
      const recipe = mapMealToRecipe(meal);
      if (!recipe || seenRecipeIds.has(recipe.recipe_id)) {
        skipped++;
        continue;
      }

      seenRecipeIds.add(recipe.recipe_id);
      batch.push(recipe);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  await flushBatch();

  console.log(`Done. Fetched ${fetched}, upserted ${upserted}, skipped ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
