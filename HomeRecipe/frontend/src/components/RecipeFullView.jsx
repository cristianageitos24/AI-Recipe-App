import React from "react";
import "../styling/RecipeFullView.css";

function RecipeFullView({ recipeData }) {
  const ingredientSplitter = (ingredientString) => {
    let ingredients = ingredientString.split("***");
    return (
      <ul className="ingredients-content">
        {ingredients.map((item, index) => (
          <li key={index} className="bullet-points">
            {item.trim()}
          </li>
        ))}
      </ul>
    );
  };

  const capitalizeFirstLetter = (string) => {
    if (string.includes("/")) {
      string = string.replace(/\/(.)/g, (_, char) => `/${char.toUpperCase()}`);
    }

    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const handleOpenLink = (e, url) => {
    e.stopPropagation();
    window.open(url, "_blank");
  };

  return (
    <div
      className="more-information-container"
      onClick={(e) => e.stopPropagation()}
    >
      {/* THIS IS IMAGE BOX */}
      <div className="more-information-image-box">
        <div className="more-info-image-blur" />
        <img
          className="more-info-image"
          src={recipeData.image_url}
          alt={recipeData.recipe_label}
        />
        <h1 className="more-info-recipe-label">{recipeData.recipe_label}</h1>
      </div>

      {/* THIS IS FULL DETAILS */}
      <div className="full-information">
        <div className="bubble-content">
          <p>{capitalizeFirstLetter(recipeData.cuisine_type)}</p>
          <p>{capitalizeFirstLetter(recipeData.meal_type)}</p>
          <p>{recipeData.calories} calories</p>
          {recipeData.time_in_minutes < 1 ? (
            <p>1 minute</p>
          ) : (
            <p>{recipeData.time_in_minutes} minutes</p>
          )}
        </div>
        <h1 className="ingredients-subtitle">Ingredients</h1>

        <div>{ingredientSplitter(recipeData.ingredient_lines)}</div>

        <button
          className="recipe-fullview-openlink-btn"
          onClick={(e) => handleOpenLink(e, recipeData.website_url)}
        >
          <svg
            className="openlink-icon"
            width="500"
            height="500"
            viewBox="0 0 500 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M313.226 2.70261C305.244 6.93305 301.135 13.6312 300.665 23.2672C300.196 33.0208 303.131 39.4839 310.761 45.1245L315.926 48.7674L365.349 49.1199L414.772 49.4725L306.065 158.406C228.938 235.612 196.654 268.868 194.776 272.511C192.663 276.624 192.311 279.209 192.663 285.084C193.132 293.428 196.654 299.538 203.698 304.239C208.746 307.764 219.311 308.822 226.003 306.707C229.759 305.532 251.242 284.614 340.697 195.305L450.695 85.1962V133.259V181.204L453.747 186.962C455.508 190.017 459.029 194.13 461.612 195.893C465.838 198.83 467.364 199.183 475.465 199.183C483.682 199.183 484.974 198.83 489.552 195.658C492.252 193.66 495.774 189.782 497.3 186.962L500 181.791V99.8852V17.9792L497.3 12.8087C495.774 9.98836 492.252 5.99295 489.552 4.11275L484.504 0.587387L401.507 0.23485L318.509 -0.000174327L313.226 2.70261Z"
              fill="white"
            />
            <path
              d="M56.258 77.0731C35.4793 82.4786 16.9311 97.6377 7.53959 116.91C-0.560585 133.361 -0.208404 123.255 0.143777 290.945L0.495959 442.419L3.5482 450.292C12.2353 472.619 27.8487 488.248 50.1535 496.944L58.0189 500H211.218H364.417L372.634 497.414C394.704 490.364 412.196 473.442 421.235 450.292L424.288 442.419L424.64 355.812C424.992 272.026 424.875 268.971 422.644 264.74C412.9 245.586 387.543 245.586 377.8 264.623C375.687 268.853 375.569 272.613 375.569 347.821C375.569 404.345 375.217 428.2 374.161 432.195C372.282 439.716 364.065 447.942 356.551 449.822C348.686 451.82 76.0976 451.82 68.2322 449.822C60.719 447.942 52.5014 439.716 50.6231 432.195C49.5666 428.082 49.2144 390.243 49.2144 287.537C49.2144 130.424 48.6274 140.06 58.0189 131.834C61.1886 129.131 65.4147 126.663 68.5844 125.841C72.1062 125.018 98.4024 124.548 152.169 124.548C226.01 124.548 230.823 124.313 235.284 122.315C254.536 113.384 254.771 87.2966 235.636 77.4256C231.41 75.3104 227.653 75.1929 147.003 75.3104C77.5063 75.3104 61.5407 75.6629 56.258 77.0731Z"
              fill="white"
            />
          </svg>
          Show Recipe
        </button>
      </div>
    </div>
  );
}

/*

information recipeData has:

calories : "398.12"
cuisine_type : "american"
image_url : "https://edamam-product-images.s3.amazonaws.com/web-img/c54/c54be837b1417970e025b7f9ec5917ce-l.jpg?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaCXVzLWVhc3QtMSJIMEYCIQCuMs%2BiokKYJ2PQ79yUTftbY%2FF%2FHChGz58KySPGFwnEcAIhAMDLUTRDEUwh%2FzKEbKGvSWJiPoS91dPbFa6u4QaVmc0FKsEFCPn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMTg3MDE3MTUwOTg2Igw%2B5jppZ5w7TKzqbaUqlQWfIcvDqknaPg2EqvLyZZe3vNYKn8X6SHtidpwU9BuD3r6%2B2S3Vjclwe6cY4Y9kVhrmzM%2F%2F1hxgtqLldr71XT%2FZeNvmkhPycKJ8zX%2BElWWeMxAOth7Sdntr1uONnT0Qx7o9Pw9zCPGyS4SM1BE9ZCKaqppKGWeu%2BylJwHHn%2F1Kvci9NCAHyyekqjGL%2FDmZ0gwnCy5Irnf5Gs5QntyAkOuj%2BSKH%2BG3p20bR%2BXi4DILc%2Buk%2FFCghB80%2F1SUZcuzgVyOoh6scaHh6K0OVLJzQ2U02ZOJxJnA%2FbGBwFkCfgN83f39No4n%2BT%2Fe29gmBDTAp67GLLbu2R0k3z490bHyTrtkhtbbDdN4baOJNs2lz40zugujbVCX5UEL7Z%2BeLUqmvm8xhrRPSk0NnjtYuQY3easrK77Q%2FK4BggLtXm7qFTnoeoeBkvCC01SVOAY6xqnSmdy9QstYizA8rR%2FXhMCLt45ot1LPl6PCIRgkXbmYP4B6Ebf%2FspCnLTk%2BJh1oSC%2BDPmqHXcZTBahZBPb2Fhfm3Hp4mkANqU64u2Nzd1vnWZUW7oyioDACu8t2gCftnA%2Fm3zejoqwqEkYufSMSNzKGQbRjP4AciwKQHeF3cfkVZObW0eYIp7bprRsDJIZYECPxgL9aQiBwAg0ep%2Beq30tp%2Fr5ra6rCmWs%2FqEB3v%2BIWSf9mjgr36Ir3Jc%2FH9k4mEhtteZxBrP64AojMFMcVRSOMmNA7inReQSrF6%2Bxyv6fCqmizIqLvJ0%2FCRKREEwh3WVKDJJ2mzNGcCM2J8WI3W8oaLBhhpSGAy8ZJyG4T5Yf%2FtuzvVDf0RbzLiu9Qk1Kk73aOTBlyJx9ZcRWQOEMrQLgbV8XsNnTyC0CNK7LcEcVnXaJkb6U8fEmOFoMIfw97MGOrABRQ1eEAXGxzZ%2F%2Bu7OsDX1Ke5hpCYmDjw%2FWkFgd3%2Fr2c50MJxqh6gD0vIAdFeVx7547kdLXKuTgCd0jPESk2H5sVjo5wPf8zs2la%2BIAEVPWyQLVDAMWsFAV1ZBAfQpb1AFx2hXdHgD%2BDScyYoh0rtQQWigPGRcxZYh68N1fwN%2FbMmUq3okvoJTOR6oXnmoh%2BcdzFGIX7HKvXJWMoevajMOb5lNpOQPfAB05t8wUpp6SYI%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240628T003038Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Credential=ASIASXCYXIIFC7ID7ZYZ%2F20240628%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=1773bf04faeb0f0fc625b9e13408eaee54bcb0aa79f3c2c599d1eeb86c19a32e"
ingredient_lines : "1 10-ounce package frozen strawberries, thawed (with their juices), or 1 quart fresh strawberries&2 cups fruit yogurt (we're partial to strawberry or lemon)"
meal_type : "lunch/dinner"
recipeID : "55025410"
recipe_label : "Yogurt Granita"
time_in_minutes : 180
website_url : "


*/

export default RecipeFullView;
