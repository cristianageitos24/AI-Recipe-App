import Link from "next/link";
import type { ReactNode } from "react";
import {
  getStatCardCaption,
  getStatFilterHref,
  type StatFilterId,
} from "@/lib/stat-filters";
import type { useHomeData } from "../_hooks/useHomeData";

type HomeStats = ReturnType<typeof useHomeData>["homeStats"];

type StatCardDef = {
  filter: StatFilterId;
  label: string;
  count: number;
  linkClass: string;
  iconClass: string;
  icon: ReactNode;
};

export function HomeStatCards({ stats }: { stats: HomeStats }) {
  const cards: StatCardDef[] = [
    {
      filter: "all",
      label: "Total Recipes",
      count: stats.totalRecipesSaved,
      linkClass: "home-stat-card-link-blue",
      iconClass: "home-stat-icon-blue",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      filter: "favorites",
      label: "Favorites",
      count: stats.favoritesCount,
      linkClass: "home-stat-card-link-green",
      iconClass: "home-stat-icon-green",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      filter: "week",
      label: "Recipes This Week",
      count: stats.recipesThisWeek,
      linkClass: "home-stat-card-link-red",
      iconClass: "home-stat-icon-red",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      filter: "imported",
      label: "Imported This Month",
      count: stats.importedThisMonth,
      linkClass: "home-stat-card-link-blue",
      iconClass: "home-stat-icon-purple",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="home-stat-cards-row">
      {cards.map((card) => {
        const caption = getStatCardCaption(card.filter, card.count);
        return (
          <Link
            key={card.filter}
            href={getStatFilterHref(card.filter)}
            className="home-stat-card home-stat-card-clickable"
            aria-label={`${card.label}, ${card.count}. ${caption}`}
          >
            <div className={`home-stat-icon-circle ${card.iconClass}`}>
              {card.icon}
            </div>
            <div className="home-stat-card-body">
              <p className="home-stat-card-label">{card.label}</p>
              <p className="home-stat-card-value">{card.count}</p>
              <span className={`home-stat-card-link ${card.linkClass}`}>
                {caption}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
