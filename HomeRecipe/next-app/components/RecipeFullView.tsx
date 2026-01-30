"use client";

import type { RecipeRow } from "@/lib/types";
import "@/app/styling/RecipeFullView.css";

function capitalizeFirstLetter(string: string): string {
  if (string.includes("/")) {
    string = string.replace(/\/(.)/g, (_, char: string) => `/${char.toUpperCase()}`);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function RecipeFullView({ recipeData }: { recipeData: RecipeRow }) {
  const ingredientLines = (recipeData.ingredient_lines ?? "").split("***").map((s) => s.trim());

  return (
    <div className="more-information-container" onClick={(e) => e.stopPropagation()}>
      <div className="more-information-image-box">
        <div className="more-info-image-blur" />
        <img
          className="more-info-image"
          src={recipeData.image_url ?? ""}
          alt={recipeData.recipe_label}
        />
        <h1 className="more-info-recipe-label">{recipeData.recipe_label}</h1>
      </div>
      <div className="full-information">
        <div className="bubble-content">
          <p>{capitalizeFirstLetter(recipeData.cuisine_type ?? "")}</p>
          <p>{capitalizeFirstLetter(recipeData.meal_type ?? "")}</p>
          <p>{recipeData.calories} calories</p>
          {recipeData.time_in_minutes < 1 ? (
            <p>1 minute</p>
          ) : (
            <p>{recipeData.time_in_minutes} minutes</p>
          )}
        </div>
        <h1 className="ingredients-subtitle">Ingredients</h1>
        <ul className="ingredients-content">
          {ingredientLines.map((item, index) => (
            <li key={index} className="bullet-points">
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="recipe-fullview-openlink-btn"
          onClick={(e) => {
            e.stopPropagation();
            window.open(recipeData.website_url ?? "", "_blank");
          }}
        >
          <svg className="openlink-icon" width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M313.226 2.70261C305.244 6.93305 301.135 13.6312 300.665 23.2672C300.196 33.0208 303.131 39.4839 310.761 45.1245L315.926 48.7674L365.349 49.1199L414.772 49.4725L306.065 158.406C228.938 235.612 196.654 268.868 194.776 272.511C192.663 276.624 192.311 279.209 192.663 285.084C193.132 293.428 196.654 299.538 203.698 304.239C208.746 307.764 219.311 308.822 226.003 306.707C229.759 305.532 251.242 284.614 340.697 195.305L450.695 85.1962V133.259V181.204L453.747 186.962C455.508 190.017 459.029 194.13 461.612 195.893C465.838 198.83 467.364 199.183 475.465 199.183C483.682 199.183 484.974 198.83 489.552 195.658C492.252 193.66 495.774 189.782 497.3 186.962L500 181.791V99.8852V17.9792L497.3 12.8087C495.774 9.98836 492.252 5.99295 489.552 4.11275L484.504 0.587387L401.507 0.23485L318.509 -0.000174327L313.226 2.70261Z" fill="white" />
            <path d="M56.258 77.0731C35.4793 82.4786 16.9311 97.6377 7.53959 116.91C-0.560585 133.361 -0.208404 123.255 0.143777 290.945L0.495959 442.419L3.5482 450.292C12.2353 472.619 27.8487 488.248 50.1535 496.944L58.0189 500H211.218H364.417L372.634 497.414C394.704 490.364 412.196 473.442 421.235 450.292L424.288 442.419L424.64 355.812C424.992 272.026 424.875 268.971 422.644 264.74C412.9 245.586 387.543 245.586 377.8 264.623C375.687 268.853 375.569 272.613 375.569 347.821C375.569 404.345 375.217 428.2 374.161 432.195C372.282 439.716 364.065 447.942 356.551 449.822C348.686 451.82 76.0976 451.82 68.2322 449.822C60.719 447.942 52.5014 439.716 50.6231 432.195C49.5666 428.082 49.2144 390.243 49.2144 287.537C49.2144 130.424 48.6274 140.06 58.0189 131.834C61.1886 129.131 65.4147 126.663 68.5844 125.841C72.1062 125.018 98.4024 124.548 152.169 124.548C226.01 124.548 230.823 124.313 235.284 122.315C254.536 113.384 254.771 87.2966 235.636 77.4256C231.41 75.3104 227.653 75.1929 147.003 75.3104C77.5063 75.3104 61.5407 75.6629 56.258 77.0731Z" fill="white" />
          </svg>
          Show Recipe
        </button>
      </div>
    </div>
  );
}
