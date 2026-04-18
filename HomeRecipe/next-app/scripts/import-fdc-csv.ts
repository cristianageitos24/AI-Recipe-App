/**
 * Bulk import USDA FoodData Central CSV bundles into public.fdc_* tables.
 * Run after migrations (026_fdc_nutrition_layer.sql) and with service role credentials.
 *
 * Data paths (repo root AI-Recipe-App/data/...):
 *   Foundation: FoodData_Central_foundation_food_csv_2025-12-18
 *   SR Legacy:  FoodData_Central_sr_legacy_food_csv_2018-04
 *
 * Usage:
 *   npm run import:fdc
 *   npm run import:fdc -- --foundation-only
 *   npm run import:fdc -- --sr-only
 *   npm run import:fdc -- --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or service role) in .env.local
 */

import { config } from "dotenv";
import { createReadStream } from "fs";
import { resolve, join } from "path";
import { parse } from "csv-parse";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const DEFAULT_FOUNDATION =
  resolve(__dirname, "../../../data/FoodData_Central_foundation_food_csv_2025-12-18");
const DEFAULT_SR =
  resolve(__dirname, "../../../data/FoodData_Central_sr_legacy_food_csv_2018-04");

const BATCH = 400;

function parseIntOpt(s: string | undefined): number | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOpt(s: string | undefined): number | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseBigIntOpt(s: string | undefined): bigint | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

async function* readCsvRows(
  filePath: string
): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(filePath).pipe(
    parse({
      columns: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    })
  );
  for await (const row of parser) {
    yield row as Record<string, string>;
  }
}

async function upsertBatches<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string
): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

async function importNutrientDefsMerged(
  supabase: SupabaseClient,
  foundationDir: string,
  srDir: string,
  loadSr: boolean
): Promise<number> {
  const map = new Map<
    number,
    { id: number; name: string; unit_name: string | null; nutrient_nbr: string | null; rank: number | null }
  >();

  const ingest = (row: Record<string, string>, allowOverwrite: boolean) => {
    const id = parseIntOpt(row.id);
    if (id === null) return;
    const name = row.name?.trim();
    if (!name) return;
    const entry = {
      id,
      name,
      unit_name: row.unit_name?.trim() || null,
      nutrient_nbr: row.nutrient_nbr?.trim() || null,
      rank: parseFloatOpt(row.rank),
    };
    if (allowOverwrite || !map.has(id)) map.set(id, entry);
  };

  for await (const row of readCsvRows(join(foundationDir, "nutrient.csv"))) {
    ingest(row, true);
  }
  if (loadSr) {
    for await (const row of readCsvRows(join(srDir, "nutrient.csv"))) {
      ingest(row, false);
    }
  }

  const rows = [...map.values()];
  return upsertBatches(supabase, "fdc_nutrient_defs", rows, "id");
}

async function importMeasureUnitsMerged(
  supabase: SupabaseClient,
  foundationDir: string,
  srDir: string,
  loadSr: boolean
): Promise<number> {
  const map = new Map<number, { id: number; name: string }>();
  const ingest = (row: Record<string, string>, allowOverwrite: boolean) => {
    const id = parseIntOpt(row.id);
    if (id === null) return;
    const name = row.name?.trim();
    if (!name) return;
    if (allowOverwrite || !map.has(id)) map.set(id, { id, name });
  };
  for await (const row of readCsvRows(join(foundationDir, "measure_unit.csv"))) {
    ingest(row, true);
  }
  if (loadSr) {
    for await (const row of readCsvRows(join(srDir, "measure_unit.csv"))) {
      ingest(row, false);
    }
  }
  return upsertBatches(supabase, "fdc_measure_units", [...map.values()], "id");
}

async function importFoodCategoriesMerged(
  supabase: SupabaseClient,
  foundationDir: string,
  srDir: string,
  loadSr: boolean
): Promise<number> {
  const map = new Map<
    number,
    { id: number; code: string | null; description: string }
  >();
  const ingest = (row: Record<string, string>, allowOverwrite: boolean) => {
    const id = parseIntOpt(row.id);
    if (id === null) return;
    const description = row.description?.trim();
    if (!description) return;
    const code = row.code?.trim() || null;
    if (allowOverwrite || !map.has(id)) map.set(id, { id, code, description });
  };
  for await (const row of readCsvRows(join(foundationDir, "food_category.csv"))) {
    ingest(row, true);
  }
  if (loadSr) {
    for await (const row of readCsvRows(join(srDir, "food_category.csv"))) {
      ingest(row, false);
    }
  }
  return upsertBatches(supabase, "fdc_food_categories", [...map.values()], "id");
}

async function loadFoundationEnrichment(
  foundationDir: string
): Promise<Map<number, { ndb: string | null; footnote: string | null }>> {
  const m = new Map<number, { ndb: string | null; footnote: string | null }>();
  for await (const row of readCsvRows(join(foundationDir, "foundation_food.csv"))) {
    const fdcId = parseIntOpt(row.fdc_id);
    if (fdcId === null) continue;
    m.set(fdcId, {
      ndb: row.NDB_number?.trim() || null,
      footnote: row.footnote?.trim() || null,
    });
  }
  return m;
}

async function loadSrEnrichment(
  srDir: string
): Promise<Map<number, { ndb: string | null }>> {
  const m = new Map<number, { ndb: string | null }>();
  for await (const row of readCsvRows(join(srDir, "sr_legacy_food.csv"))) {
    const fdcId = parseIntOpt(row.fdc_id);
    if (fdcId === null) continue;
    m.set(fdcId, {
      ndb: row.NDB_number?.trim() || null,
    });
  }
  return m;
}

async function importFoodsForBundle(
  supabase: SupabaseClient,
  foodCsvPath: string,
  dataType: string,
  enrich: Map<number, { ndb?: string | null; footnote?: string | null }>
): Promise<number> {
  const rows: {
    fdc_id: number;
    data_type: string;
    description: string;
    food_category_id: number | null;
    publication_date: string | null;
    ndb_number: string | null;
    footnote: string | null;
    brand_owner: null;
    gtin_upc: null;
  }[] = [];

  for await (const row of readCsvRows(foodCsvPath)) {
    if (row.data_type !== dataType) continue;
    const fdc_id = parseIntOpt(row.fdc_id);
    if (fdc_id === null) continue;
    const description = row.description?.trim();
    if (!description) continue;
    const ex = enrich.get(fdc_id);
    rows.push({
      fdc_id,
      data_type: dataType,
      description,
      food_category_id: parseIntOpt(row.food_category_id),
      publication_date: row.publication_date?.trim() || null,
      ndb_number: ex?.ndb ?? null,
      footnote: ex?.footnote ?? null,
      brand_owner: null,
      gtin_upc: null,
    });
  }
  return upsertBatches(supabase, "fdc_foods", rows, "fdc_id");
}

async function streamNutrientsFiltered(
  supabase: SupabaseClient,
  path: string,
  allowed: Set<number>
): Promise<number> {
  let batch: Record<string, unknown>[] = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase.from("fdc_nutrients").upsert(batch, {
      onConflict: "food_nutrient_id",
    });
    if (error) throw new Error(`fdc_nutrients: ${error.message}`);
    total += batch.length;
    batch = [];
  };

  for await (const row of readCsvRows(path)) {
    const fdc_id = parseIntOpt(row.fdc_id);
    if (fdc_id === null || !allowed.has(fdc_id)) continue;
    const food_nutrient_id = parseBigIntOpt(row.id);
    if (food_nutrient_id === null) continue;
    const nutrient_id = parseIntOpt(row.nutrient_id);
    if (nutrient_id === null) continue;
    const amount = parseFloatOpt(row.amount);
    if (amount === null) continue;

    batch.push({
      food_nutrient_id: food_nutrient_id.toString(),
      fdc_id,
      nutrient_id,
      amount,
      data_points: parseIntOpt(row.data_points),
      derivation_id: parseIntOpt(row.derivation_id),
      min_val: parseFloatOpt(row.min),
      max_val: parseFloatOpt(row.max),
      median_val: parseFloatOpt(row.median),
      footnote: row.footnote?.trim() || null,
      min_year_acquired: parseIntOpt(row.min_year_acquired),
    });

    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return total;
}

async function streamPortionsFiltered(
  supabase: SupabaseClient,
  path: string,
  allowed: Set<number>
): Promise<number> {
  let batch: Record<string, unknown>[] = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase.from("fdc_food_portions").upsert(batch, {
      onConflict: "id",
    });
    if (error) throw new Error(`fdc_food_portions: ${error.message}`);
    total += batch.length;
    batch = [];
  };

  for await (const row of readCsvRows(path)) {
    const fdc_id = parseIntOpt(row.fdc_id);
    if (fdc_id === null || !allowed.has(fdc_id)) continue;
    const id = parseBigIntOpt(row.id);
    if (id === null) continue;

    batch.push({
      id: id.toString(),
      fdc_id,
      seq_num: parseIntOpt(row.seq_num),
      amount: parseFloatOpt(row.amount),
      measure_unit_id: parseIntOpt(row.measure_unit_id),
      portion_description: row.portion_description?.trim() || null,
      modifier: row.modifier?.trim() || null,
      gram_weight: parseFloatOpt(row.gram_weight),
      data_points: parseIntOpt(row.data_points),
      footnote: row.footnote?.trim() || null,
      min_year_acquired: parseIntOpt(row.min_year_acquired),
    });

    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return total;
}

async function collectFoodIds(
  foodCsvPath: string,
  dataType: string
): Promise<Set<number>> {
  const ids = new Set<number>();
  for await (const row of readCsvRows(foodCsvPath)) {
    if (row.data_type !== dataType) continue;
    const id = parseIntOpt(row.fdc_id);
    if (id !== null) ids.add(id);
  }
  return ids;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const foundationOnly = args.includes("--foundation-only");
  const srOnly = args.includes("--sr-only");
  const loadFoundation = !srOnly;
  const loadSr = !foundationOnly;

  const foundationDir =
    process.env.FDC_FOUNDATION_CSV_DIR?.trim() || DEFAULT_FOUNDATION;
  const srDir = process.env.FDC_SR_LEGACY_CSV_DIR?.trim() || DEFAULT_SR;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!dryRun && (!supabaseUrl || !secret)) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  console.log("FDC CSV import");
  console.log(`  Foundation dir: ${foundationDir}`);
  console.log(`  SR Legacy dir:  ${srDir}`);
  console.log(`  Modes: foundation=${loadFoundation} sr=${loadSr} dryRun=${dryRun}`);

  if (dryRun) {
    if (loadFoundation) {
      const n = await collectFoodIds(
        join(foundationDir, "food.csv"),
        "foundation_food"
      );
      console.log(`[dry-run] foundation_food rows to import: ${n.size}`);
    }
    if (loadSr) {
      const n = await collectFoodIds(join(srDir, "food.csv"), "sr_legacy_food");
      console.log(`[dry-run] sr_legacy_food rows to import: ${n.size}`);
    }
    return;
  }

  const supabase = createClient(supabaseUrl!, secret!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rowCounts: Record<string, number> = {};

  const { data: runRow, error: runErr } = await supabase
    .from("fdc_import_runs")
    .insert({
      source: `fdc_csv_${loadFoundation && loadSr ? "foundation_sr" : loadFoundation ? "foundation" : "sr_legacy"}`,
      fdc_release_label: loadFoundation && loadSr ? "2025-12-18+2018-04" : loadFoundation ? "2025-12-18" : "2018-04",
      started_at: new Date().toISOString(),
      row_counts: {},
    })
    .select("id")
    .single();

  if (runErr) throw new Error(runErr.message);
  const runId = runRow!.id as string;

  try {
    if (loadFoundation && loadSr) {
      rowCounts.fdc_nutrient_defs = await importNutrientDefsMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
      rowCounts.fdc_measure_units = await importMeasureUnitsMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
      rowCounts.fdc_food_categories = await importFoodCategoriesMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
    } else if (loadFoundation) {
      rowCounts.fdc_nutrient_defs = await importNutrientDefsMerged(
        supabase,
        foundationDir,
        srDir,
        false
      );
      rowCounts.fdc_measure_units = await importMeasureUnitsMerged(
        supabase,
        foundationDir,
        srDir,
        false
      );
      rowCounts.fdc_food_categories = await importFoodCategoriesMerged(
        supabase,
        foundationDir,
        srDir,
        false
      );
    } else {
      rowCounts.fdc_nutrient_defs = await importNutrientDefsMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
      rowCounts.fdc_measure_units = await importMeasureUnitsMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
      rowCounts.fdc_food_categories = await importFoodCategoriesMerged(
        supabase,
        foundationDir,
        srDir,
        true
      );
    }

    const foundationIds = loadFoundation
      ? await collectFoodIds(join(foundationDir, "food.csv"), "foundation_food")
      : null;
    const srIds = loadSr
      ? await collectFoodIds(join(srDir, "food.csv"), "sr_legacy_food")
      : null;

    if (loadFoundation) {
      const enrich = await loadFoundationEnrichment(foundationDir);
      rowCounts.fdc_foods_foundation = await importFoodsForBundle(
        supabase,
        join(foundationDir, "food.csv"),
        "foundation_food",
        enrich
      );
    }

    if (loadSr) {
      const enrich = await loadSrEnrichment(srDir);
      const enrichMap = new Map<number, { ndb?: string | null; footnote?: string | null }>();
      for (const [k, v] of enrich) enrichMap.set(k, v);
      rowCounts.fdc_foods_sr = await importFoodsForBundle(
        supabase,
        join(srDir, "food.csv"),
        "sr_legacy_food",
        enrichMap
      );
    }

    if (loadFoundation && foundationIds) {
      rowCounts.fdc_nutrients_foundation = await streamNutrientsFiltered(
        supabase,
        join(foundationDir, "food_nutrient.csv"),
        foundationIds
      );
      rowCounts.fdc_food_portions_foundation = await streamPortionsFiltered(
        supabase,
        join(foundationDir, "food_portion.csv"),
        foundationIds
      );
    }

    if (loadSr && srIds) {
      rowCounts.fdc_nutrients_sr = await streamNutrientsFiltered(
        supabase,
        join(srDir, "food_nutrient.csv"),
        srIds
      );
      rowCounts.fdc_food_portions_sr = await streamPortionsFiltered(
        supabase,
        join(srDir, "food_portion.csv"),
        srIds
      );
    }

    await supabase
      .from("fdc_import_runs")
      .update({
        finished_at: new Date().toISOString(),
        row_counts: rowCounts,
      })
      .eq("id", runId);

    console.log("Done. Row counts:", JSON.stringify(rowCounts, null, 2));
  } catch (e) {
    await supabase
      .from("fdc_import_runs")
      .update({
        finished_at: new Date().toISOString(),
        row_counts: { ...rowCounts, error: String(e) },
      })
      .eq("id", runId);
    throw e;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
