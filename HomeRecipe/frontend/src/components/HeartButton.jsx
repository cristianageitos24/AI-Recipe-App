import React, { useState } from "react";
import { handleDeleteFavorite, handlePostFavorites } from "./BackendMethods";
import "../styling/HeartButton.css";

function HeartButton({ recipeData, heartStyle, isHearted = false }) {
  const [isActive, setIsActive] = useState(isHearted);

  const sendLikedRecipe = () => {
    handlePostFavorites(recipeData);
  };

  const removeLikedRecipe = () => {
    handleDeleteFavorite(recipeData["recipeID"]);
  };

  const handleProperFunction = () => {
    isActive ? removeLikedRecipe() : sendLikedRecipe();
    setIsActive((prevToggle) => {
      const newToggle = !prevToggle;
      return newToggle;
    });
  };

  return (
    <div className="heart-btn-stage" style={heartStyle}>
      <div
        className={`heart-icon ${isActive ? "heart-btn-is-active" : ""}`}
        onClick={() => {
          handleProperFunction();
        }}
      ></div>
    </div>
  );
}

export default HeartButton;
