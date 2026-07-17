"use client";

import type { RecipeRow } from "@/lib/types";

type Props = {
  recipe: Pick<RecipeRow, "recipe_label" | "image_url" | "recipe_id">;
  onUnlock: () => void;
};

export function ProLockedRecipeCard({ recipe, onUnlock }: Props) {
  return (
    <button
      type="button"
      className="pro-locked-card"
      onClick={onUnlock}
      aria-label={`Pro recipe ${recipe.recipe_label} — upgrade to unlock`}
    >
      <div className="pro-locked-card-media">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt="" />
        ) : null}
        <div className="pro-locked-card-overlay">
          <span aria-hidden>🔒</span>
          <span>Pro library</span>
        </div>
      </div>
      <div className="pro-locked-card-label">
        <p className="pro-locked-card-title">{recipe.recipe_label}</p>
      </div>
    </button>
  );
}
