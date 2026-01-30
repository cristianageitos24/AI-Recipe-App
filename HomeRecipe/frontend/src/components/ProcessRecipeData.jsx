function ProcessRecipeData(recipeData) {
  const generateHashKey = (inputString) => {
    const index = inputString.indexOf("?X-Amz-Security-Token");

    const cleanedUrl =
      index !== -1 ? inputString.substring(0, index) : inputString;

    let hash = 0;

    if (cleanedUrl.length === 0) {
      return hash.toString();
    }

    for (let i = 0; i < cleanedUrl.length; i++) {
      const char = cleanedUrl.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString();
  };

  const getImageURL = (apiURL) => {
    if (apiURL && apiURL.images) {
      if (apiURL.images.LARGE && apiURL.images.LARGE.url) {
        return apiURL.images.LARGE.url;
      } else if (apiURL.images.REGULAR && apiURL.images.REGULAR.url) {
        return apiURL.images.REGULAR.url;
      }
    }
    return apiURL.images.SMALL.url;
  };

  const formatCalories = (calories) => {
    const parsedNumber = parseFloat(calories);

    if (isNaN(parsedNumber)) {
      console.error(calories + "is not a number");
      return null; // or any other appropriate value or action
    }
    return parseFloat(parsedNumber.toFixed(2));
  };

  const data = {
    recipeID: 0,
    calories: 0,
    recipeLabel: "",
    cuisineType: "",
    mealType: "",
    timeMin: 0,
    ingredients: "",
    imageURL: "",
    websiteURL: "",
  };

  if (recipeData) {
    data["imageURL"] = getImageURL(recipeData);
    data["recipeID"] = generateHashKey(data["imageURL"]);

    if (recipeData.calories !== null) {
      data["calories"] = formatCalories(recipeData["calories"]);
    }
    if (recipeData.label !== null) {
      data["recipeLabel"] = recipeData.label;
    }
    if (recipeData.cuisineType[0] !== null) {
      data["cuisineType"] = recipeData.cuisineType[0];
    }
    if (recipeData.mealType[0] !== null) {
      data["mealType"] = recipeData.mealType[0];
    }
    if (recipeData.totalTime !== null) {
      data["timeMin"] = recipeData.totalTime;
    }
    if (recipeData.ingredientLines !== null) {
      data["ingredients"] = recipeData.ingredientLines.join("***");
    }
    if (recipeData.url !== null) {
      data["websiteURL"] = recipeData.url;
    }
  }

  return data;
}

export default ProcessRecipeData;
