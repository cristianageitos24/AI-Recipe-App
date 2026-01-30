import React, { useEffect, useState, useMemo } from "react";
import Logo from "../images/homerecipelogo1.png";
import "../styling/HomePage.css";

import FoodImage1 from "../images/food pictures/Cooking by Maarten van den Heuvel.jpg";
import FoodImage2 from "../images/food pictures/Cooking by Calum Lewis.jpg";
import FoodImage3 from "../images/food pictures/Delicious Food by Sam Moghadam.jpg";
import FoodImage4 from "../images/food pictures/Delicious Recipes Rirri.jpg";
import FoodImage5 from "../images/food pictures/Recipes by Taylor Kiser.jpg";

function MainPageRightSection() {
  const images = useMemo(
    () => [
      "https://images.unsplash.com/photo-1485921325833-c519f76c4927?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwyfHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1511910849309-0dffb8785146?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwzfHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHw0fHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1627662168781-4345690f0bb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHw3fHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1458642849426-cfb724f15ef7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwxMHx8ZGVsaWNpb3VzJTIwZm9vZCUyMGRpc2hlc3xlbnwwfHx8fDE3MDIxODAxNDV8MA&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1486548730767-5c679e8eda6b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHw3fHxjb2xvcmZ1bCUyMGZvb2QlMjBzcGljZXN8ZW58MHx8fHwxNzAyMTgzNzQ5fDA&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1548940740-204726a19be3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHw1fHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1518736114810-3f3bedfec66a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHw4fHxjb2xvcmZ1bCUyMGZvb2QlMjBzcGljZXN8ZW58MHx8fHwxNzAyMTgzNzQ5fDA&ixlib=rb-4.0.3&q=85",
      "https://images.unsplash.com/photo-1601063458289-77247ba485ec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwxMHx8Y29sb3JmdWwlMjBmb29kJTIwc3BpY2VzfGVufDB8fHx8MTcwMjE4Mzc0OXww&ixlib=rb-4.0.3&q=85",
      FoodImage1,
      FoodImage2,
      FoodImage3,
      FoodImage4,
      FoodImage5,
      "https://images.unsplash.com/photo-1485921325833-c519f76c4927?crop=entropy&cs=srgb&fm=jpg&ixid=M3w1Mzg5OTN8MHwxfHNlYXJjaHwyfHxkZWxpY2lvdXMlMjBmb29kJTIwZGlzaGVzfGVufDB8fHx8MTcwMjE4MDE0NXww&ixlib=rb-4.0.3&q=85",
    ],
    []
  );

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const intervalTime = 10_000; // every 10 seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === images.length - 1 ? 0 : prevIndex + 1
      );
    }, intervalTime);

    return () => clearInterval(interval);
  }, [images, intervalTime]);

  return (
    <div className="right-section">
      <div className="right-section-title-logo">
        <img src={Logo} alt="logo" className="right-section-logo" />
        <h1 className="right-section-title">HomeRecipe</h1>
      </div>
      <div className="slideshow-container">
        <div className="slideshow-overlay">
          <div className="image-overlay"></div>
          <div className="text-overlay">
            <h1 className="large-pic-text">SIMPLE AND TASTY RECIPES</h1>
            <p className="small-pic-text">
              But a recipe is soulless. The essence of the recipe must come from
              you, the cook.
            </p>
          </div>
        </div>
        {images.map((image, index) => (
          <div
            key={index}
            className={`slide ${index === currentImageIndex ? "active" : ""}`}
            style={{
              transform: `translateY(-${100 * currentImageIndex}%)`,
              transition: `${
                currentImageIndex === images.length || currentImageIndex === 0
                  ? "none"
                  : "ease-in 1s"
              }`,
            }}
          >
            <img
              className="slide-image"
              src={image}
              alt={`Slide ${index + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default MainPageRightSection;
