"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { RECIPE_FOLDER_COLUMNS } from "@/lib/recipe-select";
import type { RecipeRow } from "@/lib/types";
import { getCollectionBySlug } from "@/lib/collections";

/**
 * Escape a keyword for use in Supabase ilike pattern.
 * Uses % as wildcard (Supabase/PostgreSQL convention).
 */
function toIlikePattern(kw: string): string {
  const escaped = kw.replace(/[%_\\]/g, "\\$&");
  return `%${escaped}%`;
}

/**
 * Build OR filter string for Supabase.
 * Each term: column.ilike.pattern
 */
function buildOrFilter(keywords: string[]): string {
  const terms: string[] = [];
  for (const kw of keywords) {
    const pattern = toIlikePattern(kw);
    terms.push(`ingredient_lines.ilike.${pattern}`);
    terms.push(`recipe_label.ilike.${pattern}`);
  }
  return terms.join(",");
}

/**
 * Fetch recipes for a curated cookbook collection.
 * Filters by keyword matches on ingredient_lines and recipe_label.
 */
export async function getRecipesByCollection(
  slug: string,
  options?: { limit?: number; offset?: number }
): Promise<{ error: string | null; data: RecipeRow[] | null }> {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const config = getCollectionBySlug(slug);
  if (!config) return { error: "Unknown collection", data: null };

  const limit = Math.min(options?.limit ?? 24, 100);
  const offset = options?.offset ?? 0;

  const supabase = await createClient();

  // Build query: match any include keyword in ingredient_lines or recipe_label
  const orFilter = buildOrFilter(config.includeKeywords);
  let query = supabase
    .from("recipes")
    .select(RECIPE_FOLDER_COLUMNS)
    .is("deleted_at", null)
    .or(orFilter)
    .range(offset, offset + limit - 1);

  // For low-carb: exclude recipes matching exclude keywords
  if (config.excludeKeywords && config.excludeKeywords.length > 0) {
    for (const ex of config.excludeKeywords) {
      const pattern = `%${ex.replace(/%/g, "\\%")}%`;
      query = query
        .not("ingredient_lines", "ilike", pattern)
        .not("recipe_label", "ilike", pattern);
    }
  }

  const { data, error } = await query;

  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? []) as unknown as RecipeRow[] };
}
