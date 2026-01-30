import React, { useEffect, useState } from "react";
import "../styling/TabCookbook.css"; // Import your CSS file for styling
import Cookbooks from "./Cookbooks";
import PlaceholderImage from "../images/tabcookbook-default.png";
import { handleGetFavorites } from "./BackendMethods";
import RecipeCard from "./RecipeCard";

import { motion } from "framer-motion";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function TabCookbook() {
  const [likedRecipes, setLikedRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // New loading state

  useEffect(() => {
    handleGetFavorites()
      .then((data) => {
        setLikedRecipes(data["Favorites"].reverse());
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error getting favorites:", error);
      });
  }, []);

  const likedRecipesMotionContainer = {
    hidden: { opacity: 1, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.2,
      },
    },
  };

  const likedRecipesMotionItem = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <div className="right-side-panel">
      <DndProvider backend={HTML5Backend}>
        <div className="cookbook-canvas">
          {isLoading ? ( // Check if loading, show loading state if true
            <p>{/* LOADING PLACEHOLDER */}</p>
          ) : likedRecipes.length > 0 ? ( // Check if there are liked recipes
            <div className="cookbook-content">
              <div className="tabcookbook-show-liked-recipes">
                <h1 className="sub-header-title">Liked Recipes</h1>

                <div className="cards-container">
                  <div className="scrollable-wrapper">
                    <motion.div
                      variants={likedRecipesMotionContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="recipe-cards-horizontal-list">
                        {likedRecipes.map((recipe, index) => (
                          <motion.div
                            key={index}
                            variants={likedRecipesMotionItem}
                          >
                            <RecipeCard key={index} recipeData={recipe} />
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
                <h2>Looks like you haven't found any favorite recipes yet!</h2>
                <img src={PlaceholderImage} alt="no-recipes-default" />
                <h2>
                  Explore our dishes and start liking recipes to build your
                  collection!
                </h2>
              </div>

              <Cookbooks />
            </div>
          )}
        </div>
      </DndProvider>
    </div>
  );
}

export default TabCookbook;
