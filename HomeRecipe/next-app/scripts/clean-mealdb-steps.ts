/**
 * Remove standalone "STEP 1" / "step 2" headings from already-imported
 * MealDB recipes in public.recipes.
 *
 * Run: npm run clean:mealdb-steps
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

const PAGE_SIZE = 500;

type RecipeStepRow = {
  id: string;
  recipe_id: string;
  steps: string | null;
};

function cleanStepLine(line: string): string {
  const trimmed = line.trim();
  if (/^(?:step\s*)?\d+\s*[:.)-]?$/i.test(trimmed)) return "";
  return trimmed.replace(/^step\s*\d+\s*[:.)-]\s+/i, "").trim();
}

function cleanStoredSteps(steps: string | null): string | null {
  if (!steps?.trim()) return null;

  const lines = steps
    .split("***")
    .map(cleanStepLine)
    .filter(Boolean);

  return lines.length > 0 ? lines.join("***") : null;
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
  let offset = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("recipes")
      .select("id, recipe_id, steps")
      .like("recipe_id", "mealdb-%")
      .order("recipe_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch MealDB recipes: ${error.message}`);
    }

    const rows = (data ?? []) as RecipeStepRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const cleanedSteps = cleanStoredSteps(row.steps);
      if (cleanedSteps === row.steps) continue;

      const { error: updateError } = await supabase
        .from("recipes")
        .update({ steps: cleanedSteps })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(`Failed to update ${row.recipe_id}: ${updateError.message}`);
      }

      updated++;
    }

    offset += rows.length;
  }

  console.log(`Done. Scanned ${scanned} MealDB recipes, updated ${updated}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
