"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface FolderWithCount {
  folderName: string;
  count: number;
}

const COLLECTION_CARD_OUTER_WIDTH = 170;
const COLLECTION_GRID_GAP = 12;
const DEFAULT_COLLECTION_SKELETONS = 5;

function getSkeletonCount(width: number) {
  if (width <= 0) return DEFAULT_COLLECTION_SKELETONS;
  return Math.max(1, Math.floor((width + COLLECTION_GRID_GAP) / (COLLECTION_CARD_OUTER_WIDTH + COLLECTION_GRID_GAP)));
}

function formatRecipeCount(count: number) {
  return `${count} ${count === 1 ? "recipe" : "recipes"}`;
}

function HomeCollectionSkeletonRow() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [skeletonCount, setSkeletonCount] = useState(DEFAULT_COLLECTION_SKELETONS);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateSkeletonCount = () => {
      setSkeletonCount(getSkeletonCount(grid.getBoundingClientRect().width));
    };

    updateSkeletonCount();
    const observer = new ResizeObserver(updateSkeletonCount);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className="home-collections-grid home-collections-grid-skeleton" aria-busy="true">
      {Array.from({ length: skeletonCount }, (_, index) => (
        <div key={`home-collection-skeleton-${index}`} className="home-collection-card home-collection-card-skeleton" aria-hidden="true">
          <span className="home-collection-skeleton-line home-collection-skeleton-name" />
          <span className="home-collection-skeleton-line home-collection-skeleton-count" />
        </div>
      ))}
    </div>
  );
}

export function HomeCollectionsPanel({
  foldersWithCounts,
  isLoading = false,
}: {
  foldersWithCounts: FolderWithCount[];
  isLoading?: boolean;
}) {
  return (
    <section className="home-surface-card home-collections-panel">
      <div className="home-collections-header">
        <div>
          <div className="home-collections-title-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--brand-blue)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="home-collections-icon"
              aria-hidden="true"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h2 className="home-section-title">Your Collections</h2>
          </div>
          <p className="home-section-caption">Quick access to your saved collections</p>
        </div>
        <Link href="/dashboard/cookbook" className="home-view-all-btn">View all</Link>
      </div>
      {isLoading ? (
        <HomeCollectionSkeletonRow />
      ) : (
        <div className="home-collections-grid">
          {foldersWithCounts.length > 0 ? (
            foldersWithCounts.map((f) => (
              <Link
                key={f.folderName}
                href={`/dashboard/cookbook/${encodeURIComponent(f.folderName)}`}
                className="home-collection-card"
              >
                <p className="home-collection-name">{f.folderName}</p>
                <p className="home-collection-count">{formatRecipeCount(f.count)}</p>
              </Link>
            ))
          ) : (
            <p className="home-section-empty">
              Create folders in Cookbooks to organize your recipes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
