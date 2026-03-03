"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { HeartButton } from "@/components/HeartButton";
import { RecipeFullView } from "@/components/RecipeFullView";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/RecipeListCard.css";
import "@/app/styling/CookbookPageRecipeCard.css";
import "@/app/styling/HeartButton.css";

function RecipeImage({
  imageUrl,
  alt,
}: {
  imageUrl: string | null | undefined;
  alt: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = imageUrl ?? null;

  if (!src || failedUrl === src) {
    return (
      <img
        className="image image-placeholder"
        src="/images/recipe-placeholder.png"
        alt=""
        aria-hidden
      />
    );
  }
  return (
    <img
      className="image"
      src={src}
      alt={alt}
      onError={() => setFailedUrl(src)}
    />
  );
}

export type RecipeListCardProps = {
  recipe: RecipeRow;
  isHearted?: boolean;
  className?: string;
  onFavoriteChange?: (recipe: RecipeRow, isFavorited: boolean) => void;
};

export function RecipeListCard({
  recipe,
  isHearted = false,
  className = "",
  onFavoriteChange,
}: RecipeListCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const info = recipeRowToProcessed(recipe);
  const canUseDOM = typeof window !== "undefined";

  const handleOpen = () => setIsModalOpen(true);

  return (
    <>
      <div
        className={`recipe-list-card image-bttn-container ${className}`.trim()}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      >
        <div className="image-blur" />
        <div
          className="recipe-list-card-top-btns"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div className="recipe-card-heart-wrap">
            <HeartButton
              recipeData={info}
              heartStyle={{ top: 0, right: 0 }}
              isHearted={isHearted}
              recipe={recipe}
              onFavoriteChange={onFavoriteChange}
            />
          </div>
        </div>
        <RecipeImage imageUrl={recipe.image_url} alt={recipe.recipe_label} />
        <h1 className="recipe-label recipe-title-two-words">
          {formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}
        </h1>
        <p className="recipe-card-cook-time">
          {recipe.time_in_minutes < 1 ? "1" : recipe.time_in_minutes} min
        </p>
      </div>
      {canUseDOM && isModalOpen && createPortal(
        <div
          className="recipe-full-view-overlay"
          onClick={() => setIsModalOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsModalOpen(false)}
          role="button"
          tabIndex={0}
        >
          <div className="recipe-full-view-scroll-wrapper" onClick={(e) => e.stopPropagation()}>
            <RecipeFullView recipeData={recipe} onClose={() => setIsModalOpen(false)} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
