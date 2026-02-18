"use client";

import "@/app/styling/LoadingScreen.css";

type LoadingScreenProps = {
  fullScreen?: boolean;
};

export function LoadingScreen({ fullScreen = true }: LoadingScreenProps) {
  const containerClass = fullScreen
    ? "loading-screen-overlay"
    : "loading-screen-panel";

  return (
    <div className={containerClass} role="status" aria-live="polite" aria-label="Loading">
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
