"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { getFavorites } from "@/app/actions/favorites";
import { Cookbooks } from "@/components/Cookbooks";
import { RecipeCard } from "@/components/RecipeCard";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabCookbook.css";

export default function CookbookPage() {
  const [likedRecipes, setLikedRecipes] = useState<RecipeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getFavorites().then((res) => {
      if (res.data) setLikedRecipes([...res.data].reverse());
      setIsLoading(false);
    });
  }, []);

  const containerVariants = {
    hidden: { opacity: 1, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { delayChildren: 0.1, staggerChildren: 0.2 },
    },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="right-side-panel">
      <DndProvider backend={HTML5Backend}>
        <div className="cookbook-canvas">
          {isLoading ? (
            <p className="p-6">Loading...</p>
          ) : likedRecipes.length > 0 ? (
            <div className="cookbook-content">
              <div className="tabcookbook-show-liked-recipes">
                <h1 className="sub-header-title">Liked Recipes</h1>
                <div className="cards-container">
                  <div className="scrollable-wrapper">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible">
                      <div className="recipe-cards-horizontal-list">
                        {likedRecipes.map((recipe, index) => (
                          <motion.div key={recipe.id ?? index} variants={itemVariants}>
                            <RecipeCard recipeData={recipe} />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
              <Cookbooks />
            </div>
          ) : (
            <div className="cookbook-content">
              <div className="tabcookbook-no-recipes-default">
                <h2>Looks like you haven&apos;t found any favorite recipes yet!</h2>
                <img src="/images/tabcookbook-default.png" alt="No recipes" />
                <h2>Explore our dishes and start liking recipes to build your collection!</h2>
              </div>
              <Cookbooks />
            </div>
          )}
        </div>
      </DndProvider>
    </div>
  );
}
