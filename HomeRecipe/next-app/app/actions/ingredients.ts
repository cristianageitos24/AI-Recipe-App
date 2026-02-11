"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceRoleClient } from "@/utils/supabase/server";
import { normalizeIngredientName } from "@/lib/ingredient-normalize";

/**
 * Upsert canonical ingredients derived from a recipe's ingredient_lines field.
 * - Parses the ***-joined ingredient_lines string
 * - Normalizes each line to a "raw" ingredient name
 * - Ensures a row exists in public.ingredients for each unique raw ingredient
 */
export async function upsertIngredientsFromRecipe(
  ingredientLines: string | null
): Promise<{ error: string | null }> {
  if (!ingredientLines || !ingredientLines.trim()) {
    return { error: null };
  }

  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const supabase = await createServiceRoleClient();

  const rawLines = ingredientLines.split("***");
  const seen = new Set<string>();

  for (const raw of rawLines) {
    const normalized = normalizeIngredientName(raw);
    if (!normalized) continue;

    const key = normalized.search_name;
    if (seen.has(key)) continue;
    seen.add(key);

    // Check if we already have this ingredient (by canonical search_name)
    const { data: existing, error: selectError } = await supabase
      .from("ingredients")
      .select("id, use_count")
      .eq("search_name", key)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("upsertIngredientsFromRecipe: select error", selectError.message);
      continue;
    }

    if (existing) {
      const currentCount =
        typeof existing.use_count === "number" && existing.use_count >= 0
          ? existing.use_count
          : 0;
      const { error: updateError } = await supabase
        .from("ingredients")
        .update({ use_count: currentCount + 1 })
        .eq("id", existing.id);

      if (updateError) {
        console.error("upsertIngredientsFromRecipe: update error", updateError.message);
      }
    } else {
      const { error: insertError } = await supabase.from("ingredients").insert({
        name: normalized.name,
        search_name: normalized.search_name,
        use_count: 1,
      });

      if (insertError) {
        console.error("upsertIngredientsFromRecipe: insert error", insertError.message);
      }
    }
  }

  return { error: null };
}

