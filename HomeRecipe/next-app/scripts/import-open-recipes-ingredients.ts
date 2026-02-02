/**
 * Extract ingredients from recipes table and populate ingredients table.
 * Run after: npm run import:recipes
 * Run: npm run import:ingredients
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

// Strip leading quantities/units to get core ingredient name
const QTY_REGEX =
  /^(?:\d+\s*\/\s*\d+|\d+[.,]?\d*)\s*(?:cup|cups|tbsp|tsp|oz|lb|pound|ounce|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|bag|bags|bunch|pinch|dash|dashes|to\s*taste)?\s*/i;

function normalizeIngredient(raw: string): string | null {
  let s = raw.trim();
  if (!s || s.length < 2) return null;
  s = s.replace(QTY_REGEX, "").trim();
  if (!s || s.length < 2) return null;
  s = s.replace(/\s+/g, " ").toLowerCase();
  if (s.length < 2) return null;
  return s;
}

function displayName(ingredient: string): string {
  return ingredient
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("Fetching recipes...");
  const { data: recipes, error: fetchError } = await supabase
    .from("recipes")
    .select("ingredient_lines");

  if (fetchError) {
    console.error("Fetch error:", fetchError.message);
    process.exit(1);
  }

  const countMap = new Map<string, number>();

  for (const r of recipes ?? []) {
    const lines = (r.ingredient_lines ?? "").split("***");
    for (const line of lines) {
      const normalized = normalizeIngredient(line);
      if (normalized) {
        countMap.set(normalized, (countMap.get(normalized) ?? 0) + 1);
      }
    }
  }

  console.log(`Found ${countMap.size} unique ingredients`);

  const BATCH_SIZE = 500;
  const entries = Array.from(countMap.entries())
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1]);

  let inserted = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(([searchName, useCount]) => ({
      name: displayName(searchName),
      search_name: searchName,
      use_count: useCount,
    }));

    const { error } = await supabase.from("ingredients").upsert(batch, {
      onConflict: "name",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("Insert error:", error.message);
    } else {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${entries.length} ingredients`);
    }
  }

  console.log(`Done. ${inserted} ingredients in database.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
