/**
 * Extract ingredients from recipes table and populate ingredients table.
 * Run after: npm run import:recipes
 * Run: npm run import:ingredients
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";
import { normalizeIngredientName } from "../lib/ingredient-normalize";

config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);

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
      const normalized = normalizeIngredientName(line);
      if (normalized) {
        const key = normalized.search_name;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
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
      name: normalizeIngredientName(searchName)?.name ?? searchName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
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
