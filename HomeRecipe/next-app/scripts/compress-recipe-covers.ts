#!/usr/bin/env tsx
/**
 * One-off / maintenance: lossless-recompress all objects in the recipe-covers bucket.
 * Overwrites in place (same paths/URLs). No app behavior changes.
 *
 * Run: npm run compress:covers
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { compressImageLossless } from "../lib/compress-image";

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
const BUCKET = "recipe-covers";

type ListedObject = {
  path: string;
  size: number;
  mimetype?: string;
};

async function listAll(prefix = ""): Promise<ListedObject[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  const out: ListedObject[] = [];
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id && item.metadata) {
      out.push({
        path,
        size: item.metadata?.size ? Number(item.metadata.size) : 0,
        mimetype: item.metadata?.mimetype as string | undefined,
      });
    } else {
      out.push(...(await listAll(path)));
    }
  }
  return out;
}

async function main() {
  const all = await listAll("");
  console.log(`Found ${all.length} objects in ${BUCKET}`);

  let before = 0;
  let after = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const obj of all) {
    before += obj.size || 0;
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(obj.path);
    if (dlErr || !blob) {
      console.error("download fail", obj.path, dlErr?.message);
      failed++;
      continue;
    }

    const input = Buffer.from(await blob.arrayBuffer());
    const compressed = await compressImageLossless(
      input,
      obj.mimetype || "image/png"
    );

    if (compressed.buffer.length >= input.length) {
      skipped++;
      after += input.length;
      console.log(`skip  ${obj.path} (${input.length} bytes)`);
      continue;
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(obj.path, compressed.buffer, {
        upsert: true,
        contentType: compressed.contentType,
        cacheControl: "3600",
      });

    if (upErr) {
      console.error("upload fail", obj.path, upErr.message);
      failed++;
      after += input.length;
      continue;
    }

    updated++;
    after += compressed.buffer.length;
    console.log(
      `ok    ${obj.path}: ${input.length} -> ${compressed.buffer.length} (saved ${input.length - compressed.buffer.length})`
    );
  }

  console.log("\n=== SUMMARY ===");
  console.log(
    `files: ${all.length}, updated: ${updated}, skipped: ${skipped}, failed: ${failed}`
  );
  console.log(`before: ${(before / 1024 / 1024).toFixed(2)} MB`);
  console.log(`after:  ${(after / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `saved:  ${((before - after) / 1024 / 1024).toFixed(2)} MB (${
      before ? ((1 - after / before) * 100).toFixed(1) : 0
    }%)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
