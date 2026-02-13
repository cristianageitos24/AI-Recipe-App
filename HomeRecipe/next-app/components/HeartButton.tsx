"use client";

import { useState, useEffect } from "react";
import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import { toRecipePayload } from "@/lib/processRecipeData";
import type { ProcessedRecipe } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/HeartButton.css";

type HeartButtonProps = {
  recipeData: ProcessedRecipe;
  heartStyle?: React.CSSProperties;
  isHearted?: boolean;
  recipe?: RecipeRow;
  onFavoriteChange?: (recipe: RecipeRow, isFavorited: boolean) => void;
};

export function HeartButton({
  recipeData,
  heartStyle,
  isHearted = false,
  recipe,
  onFavoriteChange,
}: HeartButtonProps) {
  const [isActive, setIsActive] = useState(isHearted);

  useEffect(() => {
    setIsActive(isHearted);
  }, [isHearted]);

  async function handleClick() {
    if (isActive) {
      const res = await removeFavorite(recipeData.recipeID);
      if (!res?.error) {
        setIsActive(false);
        if (onFavoriteChange && recipe) onFavoriteChange(recipe, false);
      }
    } else {
      const res = await addFavorite(toRecipePayload(recipeData));
      if (!res?.error) {
        setIsActive(true);
        if (onFavoriteChange && recipe) onFavoriteChange(recipe, true);
      }
    }
  }

  return (
    <div className="heart-btn-stage" style={heartStyle}>
      <div
        className={`heart-icon ${isActive ? "heart-btn-is-active" : ""}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
      />
    </div>
  );
}
