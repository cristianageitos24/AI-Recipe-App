"use client";

import { useState } from "react";
import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import { toRecipePayload } from "@/lib/processRecipeData";
import type { ProcessedRecipe } from "@/lib/processRecipeData";
import "@/app/styling/HeartButton.css";

type HeartButtonProps = {
  recipeData: ProcessedRecipe;
  heartStyle?: React.CSSProperties;
  isHearted?: boolean;
};

export function HeartButton({ recipeData, heartStyle, isHearted = false }: HeartButtonProps) {
  const [isActive, setIsActive] = useState(isHearted);

  async function handleClick() {
    if (isActive) {
      await removeFavorite(recipeData.recipeID);
    } else {
      await addFavorite(toRecipePayload(recipeData));
    }
    setIsActive((prev) => !prev);
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
