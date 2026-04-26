import Link from "next/link";
import type { RecipeRow } from "@/lib/types";

type MealPlanEntry = {
  date: string;
  recipes: Array<RecipeRow & { eventID: string }>;
  label: string;
  isToday: boolean;
};

function parseDateKey(dateKey: string): { monthAbbr: string; dayNum: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(year, month - 1, day, 12);
  return {
    monthAbbr: dt.toLocaleDateString("en", { month: "short" }).toUpperCase(),
    dayNum: dt.getDate(),
  };
}

export function HomeUpcomingPanel({ upcomingMealPlans }: { upcomingMealPlans: MealPlanEntry[] }) {
  return (
    <section className="home-surface-card home-upcoming-panel">
      <div className="home-upcoming-panel-header">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="home-collections-icon"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h2 className="home-section-title">Upcoming Recipes</h2>
      </div>
      <p className="home-section-caption">See what&apos;s cooking next</p>
      {upcomingMealPlans.length > 0 ? (
        <div className="home-upcoming-entries">
          {upcomingMealPlans.map((day) => {
            const { monthAbbr, dayNum } = parseDateKey(day.date);
            return (
              <Link key={day.date} href="/dashboard/calendar" className="home-upcoming-entry">
                <div className="home-upcoming-date-badge">
                  <span className="home-upcoming-month">{monthAbbr}</span>
                  <span className="home-upcoming-day">{dayNum}</span>
                </div>
                <div className="home-upcoming-entry-text">
                  <p className="home-upcoming-entry-label">Scheduled for</p>
                  <p className="home-upcoming-entry-date">{day.label}</p>
                </div>
                <span className="home-upcoming-chevron" aria-hidden="true">›</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="home-upcoming-empty-card">
          <div className="home-upcoming-empty-body">
            <div className="home-upcoming-empty-illustration" aria-hidden="true">
              <img
                src="/images/Recipe%20book-pana.png"
                alt=""
                className="home-upcoming-empty-image"
              />
            </div>
            <h3>No upcoming recipes</h3>
          </div>
        </div>
      )}
    </section>
  );
}
