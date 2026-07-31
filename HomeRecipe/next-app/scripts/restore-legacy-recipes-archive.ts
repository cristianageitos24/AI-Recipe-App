#!/usr/bin/env tsx
/**
 * Restore legacy_recipes_archive from a gzipped NDJSON export.
 * Recreates the table (same shape as migration 031) if missing, then inserts rows.
 *
 * Run: npx tsx scripts/restore-legacy-recipes-archive.ts --file supabase/exports/legacy_recipes_archive_YYYY-MM-DD.ndjson.gz
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { createReadStream, existsSync } from "fs";
import { resolve } from "path";
import { createGunzip } from "zlib";
import * as readline from "readline";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const fileArgIdx = process.argv.indexOf("--file");
const filePath =
  fileArgIdx >= 0
    ? resolve(process.cwd(), process.argv[fileArgIdx + 1] || "")
    : "";

if (!filePath || !existsSync(filePath)) {
  console.error(
    "Usage: npx tsx scripts/restore-legacy-recipes-archive.ts --file <path-to.ndjson.gz>"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS public.legacy_recipes_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_recipe_uuid UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_batch_id UUID,
  note TEXT,
  snapshot JSONB NOT NULL,
  CONSTRAINT legacy_recipes_archive_original_recipe_uuid_unique UNIQUE (original_recipe_uuid)
);
CREATE INDEX IF NOT EXISTS idx_legacy_recipes_archive_archived_at
  ON public.legacy_recipes_archive (archived_at);
ALTER TABLE public.legacy_recipes_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_recipes_archive FROM anon, authenticated;
`;

async function ensureTable() {
  // Use REST isn't enough for DDL; caller should apply migration 031 / 040 reverse via SQL editor
  // if table missing. We only upsert rows here and check table exists.
  const { error } = await supabase
    .from("legacy_recipes_archive")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error(
      "Table public.legacy_recipes_archive is missing or inaccessible.\n" +
        "Re-apply migration 031 (or run the CREATE TABLE SQL in the Supabase SQL editor), then re-run this script.\n" +
        "Suggested DDL:\n" +
        CREATE_SQL
    );
    throw error;
  }
}

async function main() {
  await ensureTable();
  console.log(`Restoring from ${filePath}`);

  const rl = readline.createInterface({
    input: createReadStream(filePath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  const batch: Record<string, unknown>[] = [];
  const BATCH = 500;
  let total = 0;

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("legacy_recipes_archive")
      .upsert(batch, { onConflict: "original_recipe_uuid" });
    if (error) throw error;
    total += batch.length;
    console.log(`  … upserted ${total}`);
    batch.length = 0;
  }

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    batch.push(JSON.parse(trimmed));
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  console.log(`Done. Restored ${total} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
