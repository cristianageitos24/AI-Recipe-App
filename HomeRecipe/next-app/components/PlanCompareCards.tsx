"use client";

import {
  PLAN_FEATURES,
  PLAN_PRICE_FREE,
  PLAN_PRICE_PRO_MONTHLY,
  PLAN_PRICE_PRO_YEARLY,
  featureIncluded,
  featureRowLabel,
} from "@/lib/plan-features";
import "@/app/styling/UpgradePrompt.css";

type PlanCompareCardsProps = {
  /** When set, Free card shows a dismiss CTA; Pro card shows checkout. */
  mode?: "interactive" | "static";
  onStayFree?: () => void;
  onCheckoutMonth?: () => void;
  onCheckoutYear?: () => void;
  loading?: "month" | "year" | null;
  /** Highlight Pro as the recommended plan */
  emphasizePro?: boolean;
};

function CheckIcon({ muted }: { muted?: boolean }) {
  return (
    <svg
      className={`plan-compare-check${muted ? " plan-compare-check--muted" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 7.2L5.8 10L11 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlanCompareCards({
  mode = "static",
  onStayFree,
  onCheckoutMonth,
  onCheckoutYear,
  loading = null,
  emphasizePro = true,
}: PlanCompareCardsProps) {
  const interactive = mode === "interactive";

  return (
    <div className="plan-compare-grid">
      <article className="plan-compare-card" aria-labelledby="plan-compare-free-title">
        <header className="plan-compare-card-header">
          <h3 id="plan-compare-free-title" className="plan-compare-tier">
            Free
          </h3>
          <p className="plan-compare-price">
            <span className="plan-compare-price-amount">{PLAN_PRICE_FREE}</span>
            <span className="plan-compare-price-period"> / month</span>
          </p>
        </header>
        <ul className="plan-compare-list">
          {PLAN_FEATURES.map((feature) => {
            const included = featureIncluded(feature, "free");
            return (
              <li
                key={feature.id}
                className={
                  included
                    ? "plan-compare-row"
                    : "plan-compare-row plan-compare-row--excluded"
                }
              >
                <CheckIcon muted={!included} />
                <span>{featureRowLabel(feature, "free")}</span>
              </li>
            );
          })}
        </ul>
        {interactive ? (
          <button
            type="button"
            className="upgrade-prompt-btn upgrade-prompt-btn-ghost plan-compare-cta"
            disabled={loading !== null}
            onClick={onStayFree}
          >
            Stay on Free
          </button>
        ) : null}
      </article>

      <article
        className={`plan-compare-card plan-compare-card--pro${emphasizePro ? " plan-compare-card--emphasized" : ""}`}
        aria-labelledby="plan-compare-pro-title"
      >
        <header className="plan-compare-card-header">
          <h3 id="plan-compare-pro-title" className="plan-compare-tier">
            Pro
            {emphasizePro ? (
              <span className="plan-compare-recommended">Recommended</span>
            ) : null}
          </h3>
          <p className="plan-compare-price">
            <span className="plan-compare-price-amount">{PLAN_PRICE_PRO_MONTHLY}</span>
            <span className="plan-compare-price-period"> / month</span>
          </p>
          <p className="plan-compare-price-alt">
            or {PLAN_PRICE_PRO_YEARLY}/yr
          </p>
        </header>
        <ul className="plan-compare-list">
          {PLAN_FEATURES.map((feature) => (
            <li key={feature.id} className="plan-compare-row">
              <CheckIcon />
              <span>{featureRowLabel(feature, "pro")}</span>
            </li>
          ))}
        </ul>
        {interactive ? (
          <div className="plan-compare-pro-actions">
            <button
              type="button"
              className="upgrade-prompt-btn upgrade-prompt-btn-primary plan-compare-cta"
              disabled={loading !== null}
              onClick={onCheckoutMonth}
            >
              {loading === "month"
                ? "Redirecting…"
                : `Upgrade — ${PLAN_PRICE_PRO_MONTHLY}/mo`}
            </button>
            <button
              type="button"
              className="upgrade-prompt-btn upgrade-prompt-btn-secondary plan-compare-cta"
              disabled={loading !== null}
              onClick={onCheckoutYear}
            >
              {loading === "year"
                ? "Redirecting…"
                : `Upgrade — ${PLAN_PRICE_PRO_YEARLY}/yr`}
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}
