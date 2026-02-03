"use client";

import "@/app/styling/LoadingScreen.css";

export function LoadingScreen() {
  return (
    <div className="loading-screen-overlay" role="status" aria-live="polite" aria-label="Loading">
      <div className="loading-screen-content">
        {/* Plain img to avoid next/image hydration issues in loading boundary */}
        <img
          src="/images/homerecipelogo1.png"
          alt=""
          width={40}
          height={50}
          className="loading-screen-logo"
        />
        <div className="loading-screen-bowl-wrap">
          <img
            src="/Bowl-with-Fruit-Animated.svg"
            alt=""
            width={200}
            height={200}
          />
        </div>
        <p className="loading-screen-text">Preparing…</p>
      </div>
    </div>
  );
}
