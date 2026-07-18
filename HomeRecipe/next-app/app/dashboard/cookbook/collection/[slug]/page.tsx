"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getRecipesByCollection } from "@/app/actions/collections";
import { getFavorites } from "@/app/actions/favorites";
import { getCollectionBySlug } from "@/lib/collections";
import { CookbookPageRecipeCard } from "@/components/CookbookPageRecipeCard";
import { RecipeFullView } from "@/components/RecipeFullView";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";

const PAGE_SIZE = 24;

export default function CollectionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) ?? "";
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const collection = getCollectionBySlug(slug);
  const favoriteIds = new Set(favorites.map((r) => r.recipe_id));

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getRecipesByCollection(slug, { limit: PAGE_SIZE, offset: 0 }).then((res) => {
      const rows = res.data ?? [];
      setRecipes(rows);
      setHasMore(rows.length >= PAGE_SIZE);
      setIsLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    getFavorites().then((res) => {
      if (res.data) setFavorites(res.data);
    });
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!slug || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await getRecipesByCollection(slug, {
      limit: PAGE_SIZE,
      offset: recipes.length,
    });
    const rows = res.data ?? [];
    setRecipes((prev) => [...prev, ...rows]);
    setHasMore(rows.length >= PAGE_SIZE);
    setLoadingMore(false);
  }, [slug, loadingMore, hasMore, recipes.length]);

  const handleFavoriteChange = useCallback((recipe: RecipeRow, isFavorited: boolean) => {
    if (isFavorited) {
      setFavorites((prev) =>
        prev.some((r) => r.recipe_id === recipe.recipe_id) ? prev : [...prev, recipe]
      );
    } else {
      setFavorites((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }, []);

  if (!collection) {
    return (
      <div className="main-panel">
        <button
          type="button"
          className="back-bttn"
          onClick={() => router.push("/dashboard/cookbook")}
        >
          Cookbooks
        </button>
        <p className="isLoading">Collection not found.</p>
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="bttn-titles">
        <button
          type="button"
          className="back-bttn"
          onClick={() => router.push("/dashboard/cookbook")}
        >
          Cookbooks
        </button>
        <svg
          className="arrow-icon"
          width="8"
          height="14"
          viewBox="0 0 8 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L7 7L1 13"
            stroke="black"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="folder-bttn" style={{ cursor: "default" }}>
          {collection.displayName}
        </span>
      </div>
      {isLoading ? (
        <p className="isLoading">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="empty-folder-container">
          <img
            className="empty-folder-pic"
            src="/images/emptycookbook.svg"
            alt="No recipes"
          />
          <p className="empty-folder-subtxt">
            No recipes match this collection yet.
          </p>
        </div>
      ) : (
        <>
          <div className="cookbook-page-recipe-cards-container">
            {recipes.map((recipe) => (
              <CookbookPageRecipeCard
                key={recipe.id}
                recipeData={recipe}
                onSelectRecipe={(r) => setSelectedRecipeId(r.id)}
                isHearted={favoriteIds.has(recipe.recipe_id)}
                onFavoriteChange={handleFavoriteChange}
              />
            ))}
          </div>
          {hasMore ? (
            <div style={{ display: "flex", justifyContent: "center", margin: "1.5rem 0" }}>
              <button
                type="button"
                className="back-bttn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
      {selectedRecipeId && (() => {
        const recipe = recipes.find((r) => r.id === selectedRecipeId);
        return recipe ? (
          <div
            className="recipe-full-view-overlay"
            onClick={() => setSelectedRecipeId(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedRecipeId(null)}
            role="button"
            tabIndex={0}
          >
            <div
              className="recipe-full-view-scroll-wrapper"
              onClick={(e) => e.stopPropagation()}
            >
              <RecipeFullView
                recipeData={recipe}
                onClose={() => setSelectedRecipeId(null)}
                isHearted={favoriteIds.has(recipe.recipe_id)}
                onFavoriteChange={handleFavoriteChange}
              />
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
