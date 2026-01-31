"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import type { RecipePayload } from "@/lib/types";

export async function getOrCreateRecipe(payload: RecipePayload) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: null };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("recipe_id", payload.recipeID)
    .single();

  if (existing) {
    return { error: null, data: existing };
  }

  const { data: inserted, error } = await supabase
    .from("recipes")
    .insert({
      recipe_id: payload.recipeID,
      recipe_label: payload.recipe_label,
      calories: payload.calories,
      cuisine_type: payload.cuisine_type,
      meal_type: payload.meal_type,
      time_in_minutes: payload.time_in_minutes,
      ingredient_lines: payload.ingredient_lines,
      steps: payload.steps ?? null,
      website_url: payload.website_url,
      image_url: payload.image_url,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, data: null };
  return { error: null, data: inserted };
}
