"use client";

import Link from "next/link";
import { COLLECTIONS } from "@/lib/collections";
import "@/app/styling/CuratedCookbooks.css";

export function CuratedCookbooks() {
  return (
    <div className="curated-cookbooks-section">
      <h1 className="cookbook-subtitle">Curated Cookbooks</h1>
      <div className="curated-cookbooks-grid">
        {COLLECTIONS.map((c) => (
          <Link
            key={c.slug}
            href={`/dashboard/cookbook/collection/${c.slug}`}
            className="curated-cookbook-tile"
          >
            <span className="curated-cookbook-label">{c.displayName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
