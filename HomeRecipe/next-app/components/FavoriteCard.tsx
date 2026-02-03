"use client";

import { useState, useEffect } from "react";
import { HeartButton } from "@/components/HeartButton";
import { SaveToFolderButton } from "@/components/SaveToFolderButton";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/FavoriteCard.css";

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
        className="favorite-card-pic favorite-card-pic-placeholder"
        src="/images/recipe-placeholder.png"
        alt=""
        aria-hidden
      />
    );
  }
  return (
    <img
      className="favorite-card-pic"
      src={imageUrl}
      alt={alt}
      onError={() => setImageError(true)}
    />
  );
}

export type FavoriteCardProps = {
  recipe: RecipeRow;
  folders: string[];
  isHearted?: boolean;
  className?: string;
};

export function FavoriteCard({
  recipe,
  folders,
  isHearted = true,
  className = "",
}: FavoriteCardProps) {
  const info = recipeRowToProcessed(recipe);
  const timeClass =
    recipe.time_in_minutes <= 10
      ? "green-light"
      : recipe.time_in_minutes <= 30
        ? "yellow-light"
        : "red-light";

  return (
    <div className={`favorite-card ${className}`.trim()}>
      <RecipeImage imageUrl={recipe.image_url} alt={recipe.recipe_label} />
      <div className="favorite-card-labels">
        <h1 className="recipe-title-two-words">
          {formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}
        </h1>
        <div className="label-details">
          <h3>{capitalizeFirstLetter(recipe.cuisine_type ?? "")}</h3>
          <h3>{capitalizeFirstLetter(recipe.meal_type ?? "")}</h3>
        </div>
        <div className="label-details">
          <h3>{recipe.calories} calories</h3>
          <h3 className={timeClass}>
            {recipe.time_in_minutes < 1 ? "1" : recipe.time_in_minutes} min
          </h3>
        </div>
      </div>
      <div className="favorite-card-buttons">
        <button
          type="button"
          className="open-recipe-link-btn"
          onClick={() => window.open(recipe.website_url ?? "", "_blank")}
        >
          Show Recipe
        </button>
        <div className="save-folder-btns">
          <div className="heart-btn-search-results-card">
            <HeartButton
              recipeData={info}
              heartStyle={{ top: "50%" }}
              isHearted={isHearted}
            />
          </div>
          <SaveToFolderButton folders={folders} recipeData={info} />
        </div>
      </div>
    </div>
  );
}
