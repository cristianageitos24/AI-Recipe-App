"use client";

import { useState, useEffect } from "react";
import { HeartButton } from "@/components/HeartButton";
import { SaveToFolderButton } from "@/components/SaveToFolderButton";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/RecipeListCard.css";

function capitalizeFirstLetter(string: string): string {
  if (string.includes("/")) {
    string = string.replace(/\/(.)/g, (_, char: string) => `/${char.toUpperCase()}`);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function RecipeImage({
  imageUrl,
  alt,
}: {
  imageUrl: string | null | undefined;
  alt: string;
}) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);
  if (!imageUrl || imageError) {
    return (
      <img
        className="recipe-list-card-pic recipe-list-card-pic-placeholder"
        src="/images/recipe-placeholder.png"
        alt=""
        aria-hidden
      />
    );
  }
  return (
    <img
      className="recipe-list-card-pic"
      src={imageUrl}
      alt={alt}
      onError={() => setImageError(true)}
    />
  );
}

export type RecipeListCardProps = {
  recipe: RecipeRow;
  folders: string[];
  isHearted?: boolean;
  className?: string;
  onFavoriteChange?: (recipe: RecipeRow, isFavorited: boolean) => void;
};

export function RecipeListCard({
  recipe,
  folders,
  isHearted = false,
  className = "",
  onFavoriteChange,
}: RecipeListCardProps) {
  const info = recipeRowToProcessed(recipe);
  const timeClass =
    recipe.time_in_minutes <= 10
      ? "green-light"
      : recipe.time_in_minutes <= 30
        ? "yellow-light"
        : "red-light";

  return (
    <div className={`recipe-list-card ${className}`.trim()}>
      <RecipeImage imageUrl={recipe.image_url} alt={recipe.recipe_label} />
      <div className="recipe-list-card-labels">
        <h1 className="recipe-title-two-words">
          {formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}
        </h1>
        <div className="recipe-list-card-label-details">
          <h3>{capitalizeFirstLetter(recipe.cuisine_type ?? "")}</h3>
          <h3>{capitalizeFirstLetter(recipe.meal_type ?? "")}</h3>
        </div>
        <div className="recipe-list-card-label-details">
          <h3>{recipe.calories} calories</h3>
          <h3 className={timeClass}>
            {recipe.time_in_minutes < 1 ? "1" : recipe.time_in_minutes} min
          </h3>
        </div>
      </div>
      <div className="recipe-list-card-buttons">
        <button
          type="button"
          className="recipe-list-card-open-btn"
          onClick={() => window.open(recipe.website_url ?? "", "_blank")}
        >
          Show Recipe
        </button>
        <div className="recipe-list-card-save-folder-btns">
          <div className="recipe-list-card-heart-wrap">
            <HeartButton
              recipeData={info}
              heartStyle={{ top: "50%" }}
              isHearted={isHearted}
              recipe={recipe}
              onFavoriteChange={onFavoriteChange}
            />
          </div>
          <SaveToFolderButton folders={folders} recipeData={info} />
        </div>
      </div>
    </div>
  );
}
