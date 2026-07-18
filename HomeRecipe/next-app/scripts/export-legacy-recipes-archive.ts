#!/usr/bin/env tsx
/**
 * Export public.legacy_recipes_archive to a local gzipped NDJSON file
 * (one full row JSON object per line — not Excel).
 *
 * Run: npx tsx scripts/export-legacy-recipes-archive.ts
 *
 * Restore later: npx tsx scripts/restore-legacy-recipes-archive.ts --file <path>
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

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

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 1000;
const stamp = new Date().toISOString().slice(0, 10);
const outPath = resolve(
  process.cwd(),
  "supabase/exports",
  `legacy_recipes_archive_${stamp}.ndjson.gz`
);

async function main() {
  await mkdir(dirname(outPath), { recursive: true });

  const { count, error: countErr } = await supabase
    .from("legacy_recipes_archive")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  const expected = count ?? 0;
  console.log(`Exporting ${expected} rows -> ${outPath}`);

  let written = 0;
  let lastUuid: string | null = null;

  async function* rowLines() {
    while (true) {
      let query = supabase
        .from("legacy_recipes_archive")
        .select(
          "id, original_recipe_uuid, archived_at, archive_batch_id, note, snapshot"
        )
        .order("original_recipe_uuid", { ascending: true })
        .limit(PAGE_SIZE);

      // Keyset pagination avoids OFFSET timeouts on large tables.
      if (lastUuid) {
        query = query.gt("original_recipe_uuid", lastUuid);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        written++;
        lastUuid = row.original_recipe_uuid as string;
        yield Buffer.from(`${JSON.stringify(row)}\n`, "utf8");
      }

      if (written % 10000 === 0 || data.length < PAGE_SIZE) {
        console.log(`  … ${written} / ${expected}`);
      }
      if (data.length < PAGE_SIZE) break;
    }
  }

  await pipeline(Readable.from(rowLines()), createGzip({ level: 9 }), createWriteStream(outPath));

  if (written !== expected) {
    console.error(
      `Row count mismatch: wrote ${written}, expected ${expected}. Aborting before any drop.`
    );
    process.exit(1);
  }

  console.log(`Done. Wrote ${written} rows to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
