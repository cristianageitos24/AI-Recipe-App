#!/usr/bin/env tsx
/**
 * Backfill / recompute recipe_nutrition for owned recipes.
 *
 * Default: recipes missing recipe_nutrition or with calories = 0.
 * --all: every non-deleted user-owned recipe.
 *
 * Run from next-app:
 *   npx tsx scripts/resync-recipe-nutrition.ts
 *   npx tsx scripts/resync-recipe-nutrition.ts --all
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { syncRecipeNutritionForRecipe } from "../lib/nutrition/sync-recipe-nutrition";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const syncAll = process.argv.includes("--all");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  recipe_label: string;
  calories: number | null;
  ingredient_lines: string | null;
  recipe_nutrition: { energy_kcal?: number } | { energy_kcal?: number }[] | null;
};

function hasNutrition(row: Row): boolean {
  const raw = row.recipe_nutrition;
  if (!raw) return false;
  const n = Array.isArray(raw) ? raw[0] : raw;
  return n != null && typeof n === "object";
}

async function main() {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, recipe_label, calories, ingredient_lines, recipe_nutrition(energy_kcal)")
    .is("deleted_at", null)
    .not("user_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list recipes:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as Row[];
  const targets = syncAll
    ? rows
    : rows.filter((r) => {
        const cal = Number(r.calories);
        return !hasNutrition(r) || !Number.isFinite(cal) || cal === 0;
      });

  console.log(
    JSON.stringify({
      mode: syncAll ? "all owned" : "missing nutrition or calories=0",
      owned: rows.length,
      toSync: targets.length,
    })
  );

  let ok = 0;
  let failed = 0;
  for (const row of targets) {
    const lines = (row.ingredient_lines ?? "").trim();
    if (!lines) {
      console.warn(`[skip] ${row.recipe_label} (${row.id}): no ingredient_lines`);
      continue;
    }
    process.stdout.write(`[sync] ${row.recipe_label} … `);
    const res = await syncRecipeNutritionForRecipe(supabase, row.id);
    if (!res.ok) {
      failed += 1;
      console.log(`FAIL ${res.error}`);
      continue;
    }
    ok += 1;
    console.log("ok");
  }

  console.log(JSON.stringify({ ok, failed, skipped: targets.length - ok - failed }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
