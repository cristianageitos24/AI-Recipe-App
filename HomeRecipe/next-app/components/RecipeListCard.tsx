"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HeartButton } from "@/components/HeartButton";
import { RecipeFullView } from "@/components/RecipeFullView";
import { getRecipeFull } from "@/app/actions/recipes";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/RecipeListCard.css";
import "@/app/styling/CookbookPageRecipeCard.css";
import "@/app/styling/HeartButton.css";

function isNarrowRecipe(recipe: RecipeRow): boolean {
  return recipe.ingredient_lines == null && recipe.steps == null;
}

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
  const [fullRecipe, setFullRecipe] = useState<RecipeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const info = recipeRowToProcessed(recipe);
  const canUseDOM = typeof window !== "undefined";

  const handleOpen = () => setIsModalOpen(true);

  const handleClose = () => {
    setFullRecipe(null);
    setLoadError(null);
    setLoading(false);
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (!isModalOpen || !isNarrowRecipe(recipe)) return;
    if (fullRecipe?.id === recipe.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    getRecipeFull(recipe.id).then((res) => {
      if (res.error) setLoadError(res.error);
      else if (res.data) setFullRecipe(res.data);
      setLoading(false);
    });
  }, [isModalOpen, recipe, fullRecipe?.id]);

  const displayRecipe = fullRecipe ?? recipe;
  const showLoading = isModalOpen && isNarrowRecipe(recipe) && loading;
  const showError = isModalOpen && isNarrowRecipe(recipe) && !loading && loadError != null;
  const showFullView = isModalOpen && !showLoading && !showError && (fullRecipe != null || !isNarrowRecipe(recipe));

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
          onClick={handleClose}
          onKeyDown={(e) => e.key === "Escape" && handleClose()}
          role="button"
          tabIndex={0}
        >
          <div className="recipe-full-view-scroll-wrapper" onClick={(e) => e.stopPropagation()}>
            {showLoading && (
              <div className="recipe-full-view-loading">
                <div className="recipe-full-view-loading-header">
                  <RecipeImage imageUrl={recipe.image_url} alt={recipe.recipe_label} />
                  <h1 className="recipe-label recipe-title-two-words">
                    {formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}
                  </h1>
                  <p className="recipe-card-cook-time">
                    {recipe.time_in_minutes < 1 ? "1" : recipe.time_in_minutes} min
                  </p>
                </div>
                <p className="recipe-full-view-loading-body" role="status">Loading recipe…</p>
                <button type="button" className="recipe-full-view-close-btn" onClick={handleClose} aria-label="Close">×</button>
              </div>
            )}
            {showError && (
              <div className="recipe-full-view-loading">
                <div className="recipe-full-view-loading-header">
                  <RecipeImage imageUrl={recipe.image_url} alt={recipe.recipe_label} />
                  <h1 className="recipe-label recipe-title-two-words">
                    {formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}
                  </h1>
                </div>
                <p className="recipe-full-view-loading-body recipe-full-view-error" role="alert">{loadError}</p>
                <div className="recipe-full-view-error-actions">
                  <button type="button" className="recipe-full-view-try-again-btn" onClick={() => { setLoadError(null); setLoading(true); getRecipeFull(recipe.id).then((res) => { if (res.error) setLoadError(res.error); else if (res.data) setFullRecipe(res.data); setLoading(false); }); }}>Try again</button>
                  <button type="button" className="recipe-full-view-close-btn" onClick={handleClose}>Close</button>
                </div>
              </div>
            )}
            {showFullView && (
              <RecipeFullView recipeData={displayRecipe} onClose={handleClose} />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
