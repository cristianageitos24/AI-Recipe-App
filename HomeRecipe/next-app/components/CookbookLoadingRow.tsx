"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { FolderTemplateSkeleton } from "./FolderTemplate";

const CARD_MIN_WIDTH = 190;
const GRID_GAP = 24;
const DEFAULT_COLUMNS = 5;

type CookbookLoadingRowProps = {
  createCard: ReactNode;
};

function getColumnCount(width: number) {
  if (width <= 0) return DEFAULT_COLUMNS;
  return Math.max(1, Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
}

export function CookbookLoadingRow({ createCard }: CookbookLoadingRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMNS);
  const skeletonCount = Math.max(0, columnCount - 1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumnCount = () => {
      setColumnCount(getColumnCount(container.getBoundingClientRect().width));
    };

    updateColumnCount();
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="cookbook-folders-content-container" aria-busy="true">
      {Array.from({ length: skeletonCount }, (_, index) => (
        <FolderTemplateSkeleton key={`folder-skeleton-${index}`} />
      ))}
      {createCard}
    </div>
  );
}
