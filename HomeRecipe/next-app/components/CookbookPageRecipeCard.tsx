"use client";

import { useState } from "react";
import { RecipeFullView } from "./RecipeFullView";
import { HeartButton } from "./HeartButton";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import "@/app/styling/CookbookPageRecipeCard.css";
import "@/app/styling/HeartButton.css";

type CookbookPageRecipeCardProps = {
  recipeData: RecipeRow;
  onSelectRecipe?: (recipe: RecipeRow) => void;
  folders?: string[];
  isHearted?: boolean;
  onFavoriteChange?: (recipe: RecipeRow, isFavorited: boolean) => void;
};

export function CookbookPageRecipeCard({
  recipeData,
  onSelectRecipe,
  isHearted = false,
  onFavoriteChange,
}: CookbookPageRecipeCardProps) {
  const [isMoreInformationOpen, setIsMoreInformationOpen] = useState(false);

  const handleOpen = () => {
    if (onSelectRecipe) {
      onSelectRecipe(recipeData);
    } else {
      setIsMoreInformationOpen((v) => !v);
    }
  };

  return (
    <>
      <div
        className="image-bttn-container"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      >
        <div className="image-blur" />
        <div
          className="recipe-card-heart-wrap"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
          role="presentation"
        >
          <HeartButton
            recipeData={recipeRowToProcessed(recipeData)}
            heartStyle={{ top: 0, right: 0 }}
            isHearted={isHearted}
            recipe={recipeData}
            onFavoriteChange={onFavoriteChange}
          />
        </div>
        {recipeData.image_url ? (
          <img className="image" src={recipeData.image_url} alt={recipeData.recipe_label} />
        ) : (
          <img className="image image-placeholder" src="/images/recipe-placeholder.png" alt="" aria-hidden />
        )}
        <h1 className="recipe-label recipe-title-two-words">
          {formatRecipeTitleTwoWordsPerLine(recipeData.recipe_label)}
        </h1>
        <p className="recipe-card-cook-time">
          {recipeData.time_in_minutes < 1 ? "1" : recipeData.time_in_minutes} min
        </p>
      </div>
      {!onSelectRecipe && isMoreInformationOpen && (
        <div
          className="recipe-full-view-overlay"
          onClick={() => setIsMoreInformationOpen(false)}
        >
          <div className="recipe-full-view-scroll-wrapper" onClick={(e) => e.stopPropagation()}>
            <RecipeFullView recipeData={recipeData} onClose={() => setIsMoreInformationOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
