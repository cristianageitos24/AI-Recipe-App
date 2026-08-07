"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Playfair_Display } from "next/font/google";
import { getRecipesLibraryBootstrap } from "@/app/actions/dashboard";
import { RecipeListCard } from "@/components/RecipeListCard";
import {
  filterOwnedByStat,
  getStatEmptyCopy,
  getStatFilterSubtitle,
  getStatFilterTitle,
  parseStatFilter,
  sortRecipesByCreatedAtDesc,
  type StatFilterId,
} from "@/lib/stat-filters";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabCookbook.css";
import "@/app/styling/FilteredRecipesPage.css";
import "@/app/styling/TabHome.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

function FilteredRecipesContent() {
  const searchParams = useSearchParams();
  const filter = parseStatFilter(searchParams.get("filter"));

  const [ownedRecipes, setOwnedRecipes] = useState<RecipeRow[]>([]);
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRecipesLibraryBootstrap().then((res) => {
      if (cancelled) return;
      if (res.error && !res.data) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setOwnedRecipes(res.data?.ownedRecipes ?? []);
      setFavorites(res.data?.favorites ?? []);
      if (res.error) setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((r) => r.recipe_id)),
    [favorites]
  );

  const recipes = useMemo(() => {
    if (filter === "favorites") {
      return sortRecipesByCreatedAtDesc(favorites);
    }
    return sortRecipesByCreatedAtDesc(
      filterOwnedByStat(ownedRecipes, filter as Exclude<StatFilterId, "favorites">)
    );
  }, [filter, favorites, ownedRecipes]);

  const handleFavoriteChange = useCallback(
    (recipe: RecipeRow, isFavorited: boolean) => {
      if (isFavorited) {
        setFavorites((prev) =>
          prev.some((r) => r.recipe_id === recipe.recipe_id) ? prev : [...prev, recipe]
        );
      } else {
        setFavorites((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
      }
    },
    []
  );

  const title = getStatFilterTitle(filter);
  const subtitle = getStatFilterSubtitle(filter, recipes.length);
  const empty = getStatEmptyCopy(filter);

  return (
    <div className="main-panel">
      <motion.div
        className="filtered-recipes-canvas"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="cookbook-page-header">
          <div className="cookbook-page-title-row">
            <div>
              <h1
                style={{
                  fontFamily: playfairDisplay.style.fontFamily,
                  fontWeight: 800,
                  fontSize: "28px",
                  fontOpticalSizing: "auto",
                }}
              >
                {title}
              </h1>
              <p>{subtitle}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="filtered-recipes-status" role="status">
            Loading recipes…
          </p>
        ) : error && recipes.length === 0 ? (
          <p className="filtered-recipes-status filtered-recipes-error" role="alert">
            {error}
          </p>
        ) : recipes.length === 0 ? (
          <div className="filtered-recipes-empty">
            <p className="filtered-recipes-empty-message">{empty.message}</p>
            <div className="filtered-recipes-empty-ctas">
              {empty.ctas.map((cta, index) => (
                <Link
                  key={cta.href + cta.label}
                  href={cta.href}
                  className={
                    index === 0
                      ? "home-create-recipe-btn"
                      : "filtered-recipes-secondary-btn"
                  }
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="filtered-recipes-grid">
            {recipes.map((recipe) => (
              <motion.div
                key={recipe.id ?? recipe.recipe_id}
                className="filtered-recipes-card-wrap"
                whileHover={{
                  y: -4,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.12)",
                }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <RecipeListCard
                  recipe={recipe}
                  isHearted={favoriteIds.has(recipe.recipe_id)}
                  onFavoriteChange={handleFavoriteChange}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function FilteredRecipesPage() {
  return (
    <Suspense
      fallback={
        <div className="main-panel">
          <p className="filtered-recipes-status" role="status">
            Loading recipes…
          </p>
        </div>
      }
    >
      <FilteredRecipesContent />
    </Suspense>
  );
}
