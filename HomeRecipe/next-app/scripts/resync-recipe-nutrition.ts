#!/usr/bin/env tsx
/**
 * Backfill / recompute recipe_nutrition for recipes.
 *
 * Modes:
 *   (default)     owned recipes missing nutrition or calories = 0
 *   --all         every non-deleted user-owned recipe
 *   --catalog     shared catalog (user_id IS NULL) missing nutrition
 *   --catalog-all every catalog recipe with ingredient_lines
 *   --db-all      every non-deleted recipe with ingredient_lines
 *
 * Run from next-app:
 *   npx tsx scripts/resync-recipe-nutrition.ts
 *   npx tsx scripts/resync-recipe-nutrition.ts --catalog
 *   npx tsx scripts/resync-recipe-nutrition.ts --db-all
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

const syncOwnedAll = process.argv.includes("--all");
const syncCatalogMissing = process.argv.includes("--catalog");
const syncCatalogAll = process.argv.includes("--catalog-all");
const syncDbAll = process.argv.includes("--db-all");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = {
  id: string;
  recipe_label: string;
  calories: number | null;
  user_id: string | null;
  ingredient_lines: string | null;
  recipe_nutrition: { energy_kcal?: number } | { energy_kcal?: number }[] | null;
};

function hasNutrition(row: Row): boolean {
  const raw = row.recipe_nutrition;
  if (!raw) return false;
  const n = Array.isArray(raw) ? raw[0] : raw;
  return n != null && typeof n === "object";
}

async function fetchAllRecipes(): Promise<Row[]> {
  const pageSize = 200;
  const out: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, recipe_label, calories, user_id, ingredient_lines, recipe_nutrition(energy_kcal)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Row[];
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

async function main() {
  const rows = await fetchAllRecipes();

  let targets: Row[];
  let mode: string;

  if (syncDbAll) {
    mode = "all DB recipes with ingredients";
    targets = rows.filter((r) => (r.ingredient_lines ?? "").trim().length > 0);
  } else if (syncCatalogAll) {
    mode = "all catalog recipes with ingredients";
    targets = rows.filter(
      (r) =>
        r.user_id == null && (r.ingredient_lines ?? "").trim().length > 0
    );
  } else if (syncCatalogMissing) {
    mode = "catalog missing nutrition";
    targets = rows.filter(
      (r) =>
        r.user_id == null &&
        !hasNutrition(r) &&
        (r.ingredient_lines ?? "").trim().length > 0
    );
  } else if (syncOwnedAll) {
    mode = "all owned";
    targets = rows.filter((r) => r.user_id != null);
  } else {
    mode = "owned missing nutrition or calories=0";
    targets = rows.filter((r) => {
      if (r.user_id == null) return false;
      const cal = Number(r.calories);
      return !hasNutrition(r) || !Number.isFinite(cal) || cal === 0;
    });
  }

  console.log(
    JSON.stringify({
      mode,
      totalInDb: rows.length,
      toSync: targets.length,
    })
  );

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const started = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const lines = (row.ingredient_lines ?? "").trim();
    if (!lines) {
      skipped += 1;
      continue;
    }
    const label = `[${i + 1}/${targets.length}] ${row.recipe_label}`;
    process.stdout.write(`${label} … `);
    try {
      const res = await syncRecipeNutritionForRecipe(supabase, row.id);
      if (!res.ok) {
        failed += 1;
        console.log(`FAIL ${res.error}`);
      } else {
        ok += 1;
        console.log("ok");
      }
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${e instanceof Error ? e.message : String(e)}`);
    }

    if ((i + 1) % 25 === 0) {
      const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
      console.log(
        JSON.stringify({ progress: i + 1, ok, failed, skipped, elapsedMin })
      );
    }
  }

  console.log(
    JSON.stringify({
      ok,
      failed,
      skipped,
      elapsedSec: Math.round((Date.now() - started) / 1000),
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
