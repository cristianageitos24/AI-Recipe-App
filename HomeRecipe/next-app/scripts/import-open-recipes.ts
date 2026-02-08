/**
 * One-time script to import Open Recipes into the recipes table.
 * Run: npm run import:recipes
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 * (Secret key bypasses RLS for bulk insert. Publishable key may fail on insert.)
 *
 * Downloads recipeitems-latest.json.gz from Open Recipes, parses NDJSON,
 * maps to recipe schema, and inserts in batches.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { createGunzip } from "zlib";

config({ path: join(process.cwd(), ".env.local") });

const OPEN_RECIPES_URL =
  "https://github.com/jakevdp/open-recipe-data/raw/main/recipeitems.json.gz";
const BATCH_SIZE = 500;
const LOCAL_PATH = join(process.cwd(), "recipeitems.json.gz");

type OpenRecipeRow = {
  name?: string;
  ingredients?: string;
  url?: string;
  image?: string;
  prepTime?: string;
  cookTime?: string;
  recipeYield?: string;
  datePublished?: string;
  description?: string;
};

function generateRecipeId(url: string): string {
  const index = url.indexOf("?");
  const cleaned = index !== -1 ? url.substring(0, index) : url;
  let hash = 0;
  if (cleaned.length === 0) return "open-" + Math.abs(hash).toString(36);
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "open-" + Math.abs(hash).toString(36);
}

/** Parse ISO 8601 duration (e.g. PT15M, PT1H30M) to minutes */
function parseDurationToMinutes(dur: string | undefined): number {
  if (!dur || typeof dur !== "string") return 0;
  const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const mins = parseInt(match[2] ?? "0", 10);
  const secs = parseInt(match[3] ?? "0", 10);
  return hours * 60 + mins + Math.round(secs / 60);
}

function mapToRecipe(row: OpenRecipeRow) {
  const url = row.url?.trim();
  const name = row.name?.trim();
  if (!url || !name) return null;

  const prepMin = parseDurationToMinutes(row.prepTime);
  const cookMin = parseDurationToMinutes(row.cookTime);
  const timeInMinutes = prepMin + cookMin || 0;

  let ingredientLines: string | null = null;
  if (row.ingredients && typeof row.ingredients === "string") {
    const lines = row.ingredients
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    ingredientLines = lines.length > 0 ? lines.join("***") : null;
  }

  const recipeId = generateRecipeId(url);

  return {
    recipe_id: recipeId,
    recipe_label: name,
    calories: 0,
    cuisine_type: null,
    meal_type: null,
    time_in_minutes: timeInMinutes,
    ingredient_lines: ingredientLines,
    website_url: url,
    image_url: row.image?.trim() || null,
  };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  }
  const ws = createWriteStream(dest);
  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      ws.write(Buffer.from(value));
    }
  } finally {
    ws.end();
  }
  return new Promise((resolve, reject) => {
    ws.on("finish", resolve);
    ws.on("error", reject);
  });
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
    console.error("Create .env.local with these variables.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);

  let inputPath = LOCAL_PATH;
  if (!existsSync(LOCAL_PATH)) {
    console.log("Downloading recipeitems-latest.json.gz...");
    await downloadFile(OPEN_RECIPES_URL, LOCAL_PATH);
    console.log("Download complete.");
  } else {
    console.log("Using cached", LOCAL_PATH);
  }

  const fileStream = createReadStream(inputPath);
  const gunzip = createGunzip();
  const rl = createInterface({
    input: fileStream.pipe(gunzip),
    crlfDelay: Infinity,
  });

  const batch: Record<string, unknown>[] = [];
  let total = 0;
  let inserted = 0;
  let skipped = 0;
  const seenIds = new Set<string>();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row: OpenRecipeRow;
    try {
      row = JSON.parse(trimmed) as OpenRecipeRow;
    } catch {
      continue;
    }

    const recipe = mapToRecipe(row);
    if (!recipe) {
      skipped++;
      continue;
    }

    if (seenIds.has(recipe.recipe_id)) {
      skipped++;
      continue;
    }
    seenIds.add(recipe.recipe_id);

    batch.push(recipe);
    total++;

    if (batch.length >= BATCH_SIZE) {
      const { data, error } = await supabase
        .from("recipes")
        .upsert(batch, {
          onConflict: "recipe_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        console.error("Insert error:", error.message);
      } else {
        const count = data?.length ?? 0;
        inserted += count;
        console.log(`Batch: ${inserted} inserted, ${total} processed`);
      }
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    const { data, error } = await supabase
      .from("recipes")
      .upsert(batch, {
        onConflict: "recipe_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      console.error("Final insert error:", error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  console.log(`Done. Total processed: ${total}, inserted: ${inserted}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
