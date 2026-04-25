"use client";

import Link from "next/link";
import { COLLECTIONS } from "@/lib/collections";
import "@/app/styling/CuratedCookbooks.css";

const collectionIcons: Record<string, string> = {
  chicken: "🍗",
  beef: "🥩",
  fish: "🐟",
  pork: "🥓",
  turkey: "🦃",
  seafood: "🦐",
  eggs: "🥚",
  lamb: "🍖",
  "high-protein": "💪",
  "low-carb": "🥑",
  vegetarian: "🌿",
  vegan: "🌱",
  salads: "🥗",
  soups: "🍲",
  pasta: "🍝",
  rice: "🍚",
  desserts: "🍰",
  breakfast: "☀️",
  mediterranean: "🫒",
  asian: "🥢",
  italian: "🍕",
  mexican: "🌮",
  indian: "🔥",
  pizza: "🍕",
  tacos: "🌮",
  grilled: "•••",
};

export function CuratedCookbooks() {
  return (
    <div className="curated-cookbooks-section">
      <div className="curated-cookbooks-grid">
        <Link href="/dashboard/cookbook" className="curated-cookbook-tile active">
          <span className="curated-cookbook-icon">▦</span>
          <span className="curated-cookbook-label">All Recipes</span>
        </Link>
        {COLLECTIONS.map((c) => (
          <Link
            key={c.slug}
            href={`/dashboard/cookbook/collection/${c.slug}`}
            className="curated-cookbook-tile"
          >
            <span className="curated-cookbook-icon">{collectionIcons[c.slug] ?? "•"}</span>
            <span className="curated-cookbook-label">{c.displayName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
