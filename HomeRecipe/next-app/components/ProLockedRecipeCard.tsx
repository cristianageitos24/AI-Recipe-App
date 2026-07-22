"use client";

import { ProPill } from "@/components/ProPill";
import type { RecipeRow } from "@/lib/types";

type Props = {
  recipe: Pick<RecipeRow, "recipe_label" | "image_url" | "recipe_id">;
  onUnlock: () => void;
};

const FALLBACK_IMAGE = "/images/recipe-placeholder.png";

export function ProLockedRecipeCard({ recipe, onUnlock }: Props) {
  return (
    <button
      type="button"
      className="pro-locked-card"
      onClick={onUnlock}
      aria-label={`Recipe Library recipe ${recipe.recipe_label} — upgrade to unlock`}
    >
      <div className="pro-locked-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recipe.image_url || FALLBACK_IMAGE}
          alt=""
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith(FALLBACK_IMAGE)) {
              img.src = FALLBACK_IMAGE;
            }
          }}
        />
        <div className="pro-locked-card-overlay">
          <span aria-hidden>🔒</span>
          <span className="pro-locked-card-overlay-label">
            Recipe Library
            <ProPill />
          </span>
        </div>
      </div>
      <div className="pro-locked-card-label">
        <p className="pro-locked-card-title">{recipe.recipe_label}</p>
      </div>
    </button>
  );
}
