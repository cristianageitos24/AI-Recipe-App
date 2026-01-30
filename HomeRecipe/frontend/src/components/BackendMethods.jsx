// HANDLE USER MODEL BACKEND *****************************************************
export const handleGetUsername = async () => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  try {
    const API_URL = process.env.REACT_APP_API_URL + "/api/user";
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      //console.log(responseData);
      return responseData;
    } else {
      throw new Error("Failed to send favorite");
    }
  } catch (error) {
    console.error(error);
  }
};

// HANDLE FOLDER MODEL BACKEND *****************************************************
/**
 *
 * @param folderName Folder which will send its associated recipes to the backend
 * @param recipeData Recipe data
 * @returns HTTP response
 */
export const handlePostToFolderBackend = async (folderName, recipeData) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  let data = null;

  if (typeof recipeData === "object" && recipeData !== null) {
    data = {
      recipeID: recipeData["recipeID"],
      calories: parseFloat(recipeData["calories"].toFixed(2)),
      recipe_label: recipeData["recipeLabel"],
      cuisine_type: recipeData["cuisineType"],
      meal_type: recipeData["mealType"],
      time_in_minutes: recipeData["timeMin"],
      ingredient_lines: recipeData["ingredients"],
      image_url: recipeData["imageURL"],
      website_url: recipeData["websiteURL"],
    };
  } else if (typeof recipeData === "string" && recipeData !== null) {
    data = {
      recipeID: recipeData, //will just be recipeID
    };
  } else {
    console.error("Recipe data not proper type of either string or dictionary");
    return;
  }

  try {
    const API_URL =
      process.env.REACT_APP_API_URL + `/api/folder/${folderName}/`;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return { success: responseData };
    } else {
      throw new Error("Failed to post folder");
    }
  } catch (error) {
    return "Error posting folder :: " + error;
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 *
 * @param folderName Folder which will be return its associated recipes, "ALL" will return all folders
 * @returns List of recipes
 */
export const handleGetFoldersBackend = async (folderName) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];
  try {
    const API_URL =
      process.env.REACT_APP_API_URL + `/api/folder/${folderName}/`;
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to post folder");
    }
  } catch (error) {
    return "Error posting folder :: " + error;
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 *
 * @param folderName Folder that will be renamed
 * @param newFolderName The new name for the folder
 */
export const handleRenameFoldersBackend = async (folderName, newFolderName) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  const data = {
    folderName: newFolderName, //will just be recipeID
  };
  try {
    const API_URL =
      process.env.REACT_APP_API_URL + `/api/folder/${folderName}/`;
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to post folder");
    }
  } catch (error) {
    return "Error posting folder :: " + error;
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 *
 * @param folderName Folder which will be posted to the backend to current user logged in
 * @returns backend message either successful or failure
 */
export const handlePostFolderBackend = async (folderName) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];
  const data = {
    folder_name: folderName,
  };

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/folder/`;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to post folder");
    }
  } catch (error) {
    return "Error posting folder :: " + error;
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 *
 * @param folderName Folder which will be DELETED to the backend to current user logged in
 * @returns backend message either successful or failure
 */
export const handleDeleteFolderBackend = async (folderName) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];
  const data = {
    folderName: folderName,
  };

  try {
    const API_URL = process.env.REACT_APP_API_URL + "/api/folder/";
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to post folder");
    }
  } catch (error) {
    return "Error posting folder :: " + error;
    // Handle errors here, e.g., show an error message to the user
  }
};

// HANDLE RECIPE MODEL BACKEND *****************************************************
export const handleGetRecipe = async () => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/recipe/`;
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to send favorite");
    }
  } catch (error) {
    console.error(error);
  }
};

// HANDLE FAVORITES MODEL BACKEND *****************************************************
/**
 *
 * @param recipeData Takes info data points to send to the backend
 * @returns
 */
export const handlePostFavorites = async (recipeData) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];
  const data = {
    recipeID: recipeData["recipeID"],
    calories: parseFloat(recipeData["calories"].toFixed(2)),
    recipe_label: recipeData["recipeLabel"],
    cuisine_type: recipeData["cuisineType"],
    meal_type: recipeData["mealType"],
    time_in_minutes: recipeData["timeMin"],
    ingredient_lines: recipeData["ingredients"],
    image_url: recipeData["imageURL"],
    website_url: recipeData["websiteURL"],
  };

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/favorites/`;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to send favorite");
    }
  } catch (error) {
    console.error("Error sending favorite:", error);
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 *
 * @param imageURL Takes imageURL as key indicator for recipe being deleted
 * @returns
 */
export const handleDeleteFavorite = async (recipeID) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];
  const data = {
    recipeID: recipeID,
  };

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/favorites/`;
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to send favorite");
    }
  } catch (error) {
    console.error("Error sending favorite:", error);
  }
};

/**
 *
 * @returns All Favorite items by current user logged in
 */
export const handleGetFavorites = async () => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/favorites/`;
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to send favorite");
    }
  } catch (error) {
    console.error("Error sending favorite:", error);
    // Handle errors here, e.g., show an error message to the user
  }
};

// HANDLE MEAL DATES MODEL BACKEND *****************************************************

/**
 *
 * @returns All meal dates by current user logged in
 */
export const handleGetMealDates = async () => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/mealdates/`;
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to get meal dates");
    }
  } catch (error) {
    console.error("Error sending meal dates:", error);
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 * @param info Takes date and recipeID to send to the backend
 * @returns All meal dates by current user logged in
 */
export const handlePostMealDates = async (info) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  //console.log(info);
  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/mealdates/`;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(info),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to post meal dates");
    }
  } catch (error) {
    console.error("Error sending post meal date:", error);
    // Handle errors here, e.g., show an error message to the user
  }
};

/**
 * @param info Takes date and recipeID to send to the backend
 * @returns All meal dates by current user logged in
 */
export const handleDeleteMealDates = async (info) => {
  const authToken = JSON.parse(localStorage.getItem("token"))["token"];

  try {
    const API_URL = process.env.REACT_APP_API_URL + `/api/mealdates/`;
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${authToken}`, // Include the token in the Authorization header
      },
      body: JSON.stringify(info),
    });

    if (response.ok) {
      const responseData = await response.json();
      return responseData;
    } else {
      throw new Error("Failed to delete meal dates");
    }
  } catch (error) {
    console.error("Error sending delete meal date:", error);
    // Handle errors here, e.g., show an error message to the user
  }
};
