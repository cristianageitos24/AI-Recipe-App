"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { getCookbookBootstrap } from "@/app/actions/dashboard";
import { Cookbooks } from "@/components/Cookbooks";
import { CuratedCookbooks } from "@/components/CuratedCookbooks";
import { RecipeListCard } from "@/components/RecipeListCard";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabCookbook.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

type FoldersData = {
  folders: string[];
  folderIdsByName: Record<string, string>;
  results: Record<string, unknown[]>;
  folderCovers: Record<string, string | null>;
} | null;

export default function CookbookPage() {
  const [likedRecipes, setLikedRecipes] = useState<RecipeRow[]>([]);
  const [foldersData, setFoldersData] = useState<FoldersData>(null);
  useEffect(() => {
    getCookbookBootstrap()
      .then((res) => {
        if (!res.data) return;
        setLikedRecipes([...res.data.favorites].reverse());
        setFoldersData({
          folders: res.data.folders,
          folderIdsByName: res.data.folderIdsByName ?? {},
          results: res.data.results,
          folderCovers: res.data.folderCovers ?? {},
        });
      });
  }, []);

  const handleFavoriteChange = useCallback((recipe: RecipeRow, isFavorited: boolean) => {
    if (!isFavorited) {
      setLikedRecipes((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }, []);

  return (
    <div className="main-panel">
      <DndProvider backend={HTML5Backend}>
        <div className="cookbook-canvas">
          <div className="cookbook-page-header">
            <div className="cookbook-page-title-row">
              <span className="cookbook-page-title-icon">
                <Image
                  src="/images/dashboard/cookbook-icon.svg"
                  alt=""
                  width={21}
                  height={21}
                />
              </span>
              <div>
                <h1
                  style={{
                    fontFamily: playfairDisplay.style.fontFamily,
                    fontWeight: 800,
                    fontSize: "28px",
                    fontOpticalSizing: "auto",
                  }}
                >
                  Cookbooks
                </h1>
                <p>Discover, organize and save your favorite recipes.</p>
              </div>
            </div>
          </div>
        {likedRecipes.length > 0 ? (
          <motion.div
            className="cookbook-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <CuratedCookbooks />
            <Cookbooks initialFoldersData={foldersData} />
            <div className="tabcookbook-show-liked-recipes">
              <h1 className="sub-header-title">Liked Recipes</h1>
              <div className="tabcookbook-liked-scroll">
                {likedRecipes.map((recipe, index) => (
                  <motion.div
                    key={recipe.id ?? index}
                    className="tabcookbook-liked-card-wrap"
                    whileHover={{
                      y: -4,
                      boxShadow: "0 10px 24px rgba(0, 0, 0, 0.12)",
                    }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
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
          </motion.div>
        ) : (
          <motion.div
            className="cookbook-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <CuratedCookbooks />
            <Cookbooks initialFoldersData={foldersData} />
          </motion.div>
        )}
        </div>
      </DndProvider>
    </div>
  );
}
