import Link from "next/link";
import type { useHomeData } from "../_hooks/useHomeData";

type HomeStats = ReturnType<typeof useHomeData>["homeStats"];

export function HomeStatCards({ stats }: { stats: HomeStats }) {
  return (
    <div className="home-stat-cards-row">
      {/* Total Recipes */}
      <div className="home-stat-card">
        <div className="home-stat-icon-circle home-stat-icon-blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div className="home-stat-card-body">
          <p className="home-stat-card-label">Total Recipes</p>
          <p className="home-stat-card-value">{stats.totalRecipesSaved}</p>
          <Link href="/dashboard/recipes" className="home-stat-card-link home-stat-card-link-blue">
            Start building your cookbook
          </Link>
        </div>
      </div>

      {/* Favorites */}
      <div className="home-stat-card">
        <div className="home-stat-icon-circle home-stat-icon-green">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="home-stat-card-body">
          <p className="home-stat-card-label">Favorites</p>
          <p className="home-stat-card-value">{stats.favoritesCount}</p>
          <p className="home-stat-card-link home-stat-card-link-green">
            {stats.favoritesCount === 0 ? "No favorites yet" : "View your favorites"}
          </p>
        </div>
      </div>

      {/* Recipes This Week */}
      <div className="home-stat-card">
        <div className="home-stat-icon-circle home-stat-icon-red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div className="home-stat-card-body">
          <p className="home-stat-card-label">Recipes This Week</p>
          <p className="home-stat-card-value">{stats.recipesThisWeek}</p>
          <p className="home-stat-card-link home-stat-card-link-red">Keep cooking!</p>
        </div>
      </div>

      {/* Imported This Month */}
      <div className="home-stat-card">
        <div className="home-stat-icon-circle home-stat-icon-purple">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div className="home-stat-card-body">
          <p className="home-stat-card-label">Imported This Month</p>
          <p className="home-stat-card-value">{stats.importedThisMonth}</p>
          <Link href="/dashboard/recipes" className="home-stat-card-link home-stat-card-link-blue">
            Add some new recipes
          </Link>
        </div>
      </div>
    </div>
  );
}
