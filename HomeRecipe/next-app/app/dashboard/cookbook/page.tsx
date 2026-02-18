"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { getCookbookBootstrap } from "@/app/actions/dashboard";
import { Cookbooks } from "@/components/Cookbooks";
import { CuratedCookbooks } from "@/components/CuratedCookbooks";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RecipeListCard } from "@/components/RecipeListCard";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabCookbook.css";

type FoldersData = { folders: string[]; results: Record<string, unknown[]> } | null;

export default function CookbookPage() {
  const [likedRecipes, setLikedRecipes] = useState<RecipeRow[]>([]);
  const [foldersData, setFoldersData] = useState<FoldersData>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCookbookBootstrap()
      .then((res) => {
        if (!res.data) return;
        setLikedRecipes([...res.data.favorites].reverse());
        setFoldersData({ folders: res.data.folders, results: res.data.results });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleFavoriteChange = useCallback((recipe: RecipeRow, isFavorited: boolean) => {
    if (!isFavorited) {
      setLikedRecipes((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }, []);

  return (
    <div className="right-side-panel">
      <DndProvider backend={HTML5Backend}>
        <div className="cookbook-canvas">
        {isLoading ? (
          <LoadingScreen fullScreen={false} />
        ) : likedRecipes.length > 0 ? (
          <div className="cookbook-content">
            <CuratedCookbooks />
            <div className="tabcookbook-show-liked-recipes">
              <h1 className="sub-header-title">Liked Recipes</h1>
              <div className="tabcookbook-liked-scroll">
                {likedRecipes.map((recipe, index) => (
                  <motion.div
                    key={recipe.id ?? index}
                    className="tabcookbook-liked-card-wrap"
                    whileHover={{ scale: 1.02 }}
                  >
                    <RecipeListCard
                      recipe={recipe}
                      isHearted
                      onFavoriteChange={handleFavoriteChange}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
            <Cookbooks initialFoldersData={foldersData} />
          </div>
        ) : (
          <div className="cookbook-content">
            <CuratedCookbooks />
            <div className="tabcookbook-no-recipes-default">
              <h2>Looks like you haven&apos;t found any favorite recipes yet!</h2>
              <img src="/images/tabcookbook-default.png" alt="No recipes" />
              <h2>Explore our dishes and start liking recipes to build your collection!</h2>
            </div>
            <Cookbooks initialFoldersData={foldersData} />
          </div>
        )}
        </div>
      </DndProvider>
    </div>
  );
}
