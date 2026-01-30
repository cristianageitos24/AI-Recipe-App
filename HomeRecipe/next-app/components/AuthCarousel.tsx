"use client";

import { useState, useEffect, useMemo, useRef } from "react";

const DEFAULT_AUTH_IMAGES = [
  "/images/food pictures/Cooking by Calum Lewis.jpg",
  "/images/food pictures/Cooking by Maarten van den Heuvel.jpg",
  "/images/food pictures/Delicious Food by Sam Moghadam.jpg",
  "/images/food pictures/Delicious Recipes Rirri.jpg",
  "/images/food pictures/Recipes by Taylor Kiser.jpg",
  "/images/version1/food pictures/anna-tukhfatullina-food-photographer-stylist-Mzy-OjtCI70-unsplash.jpg",
  "/images/version1/food pictures/chad-montano--GFCYhoRe48-unsplash.jpg",
  "/images/version1/food pictures/chad-montano-MqT0asuoIcU-unsplash.jpg",
  "/images/version1/food pictures/joseph-gonzalez-zcUgjyqEwe8-unsplash.jpg",
];

const CAROUSEL_INTERVAL_MS = 2000;

type AuthCarouselProps = {
  images?: string[];
};

export default function AuthCarousel({ images }: AuthCarouselProps) {
  const list = useMemo(
    () => (images && images.length > 0 ? images : DEFAULT_AUTH_IMAGES),
    [images]
  );
  // Duplicate first slide at end so we can animate to it, then instantly reset to real first
  const displayList = useMemo(() => [...list, list[0]], [list]);
  const lastIndex = displayList.length - 1;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [noTransition, setNoTransition] = useState(false);
  const prevIndexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= lastIndex ? 0 : prev + 1));
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [lastIndex]);

  // When we jump from last (duplicate first) back to 0, disable transition so the reset is invisible
  useEffect(() => {
    if (currentIndex === 0 && prevIndexRef.current === lastIndex) {
      setNoTransition(true);
      const id = requestAnimationFrame(() => setNoTransition(false));
      return () => cancelAnimationFrame(id);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, lastIndex]);

  return (
    <div className="auth-carousel-wrap">
      <div className="auth-slideshow-container">
        <div className="auth-slideshow-overlay">
          <div className="auth-image-overlay" aria-hidden />
          <div className="auth-text-overlay">
            <h2 className="auth-large-pic-text">SIMPLE AND TASTY RECIPES</h2>
            <p className="auth-small-pic-text">
              But a recipe is soulless. The essence of the recipe must come from
              you, the cook.
            </p>
          </div>
        </div>
        <div
          className="auth-slides-strip"
          style={{
            "--slide-count": displayList.length,
            transform: `translate3d(0, -${(100 * currentIndex) / displayList.length}%, 0)`,
            transition: noTransition
              ? "none"
              : "transform 1.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
          } as React.CSSProperties & { "--slide-count": number }}
        >
          {displayList.map((src, index) => (
            <div key={`${index}-${src}`} className="auth-slide">
              <img
                className="auth-slide-image"
                src={src}
                alt=""
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
