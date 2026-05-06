"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RecipeTemplateData } from "@/lib/recipe-template";
import {
  getRecipeSourceColumnAriaLabel,
  getRecipeSourceLinkBase,
} from "@/lib/recipeSourceLink";
import "@/app/styling/RecipeTemplateShell.css";

export type RecipeTemplateShellProps = {
  template: RecipeTemplateData;
  onClose?: () => void;
  /** Save / favorite control (e.g. HeartButton). Hidden when omitted. */
  favoriteSlot?: React.ReactNode;
  cookIngredientsPanel: React.ReactNode;
  cookInstructionsPanel: React.ReactNode;
  nutritionPanel: React.ReactNode;
  /** Optional sticky mobile CTA (e.g. full-width Save / Heart). */
  mobileSaveSlot?: React.ReactNode;
  /** Replaces the static title (e.g. video extraction draft). */
  draftTitle?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Optional overlay rendered inside hero image area. */
  heroOverlay?: React.ReactNode;
  /** Shown under “Nutrition disclaimer” in the ⋯ menu (e.g. draft create-recipe warning). */
  nutritionDisclaimerMenuSubtext?: string;
  /** e.g. “Add to cookbook” — same row as favorite, Share, and ⋯ */
  cookbookActionSlot?: React.ReactNode;
  /** When provided, shows “Move to trash” in ⋯ (caller decides visibility). */
  onMoveToTrash?: () => void | Promise<void>;
};

function IconFlame() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2c0 4-4 6-4 10a4 4 0 1 0 8 0c0-4-4-6-4-10z" />
    </svg>
  );
}

function IconProtein() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 4h12v16H6zM9 8h6M9 12h6" />
    </svg>
  );
}

function IconCarb() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12c2-4 6-6 8-8 2 2 6 4 8 8-2 4-6 6-8 8-2-2-6-4-8-8z" />
    </svg>
  );
}

function IconFat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3c-4 4-7 8-7 12a7 7 0 0 0 14 0c0-4-3-8-7-12z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function macroText(n: number | null, suffix = "g"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toFixed(0)}${suffix}`;
}

export function RecipeTemplateShell({
  template,
  onClose,
  favoriteSlot,
  cookIngredientsPanel,
  cookInstructionsPanel,
  nutritionPanel,
  mobileSaveSlot,
  draftTitle,
  heroOverlay,
  nutritionDisclaimerMenuSubtext,
  cookbookActionSlot,
  onMoveToTrash,
}: RecipeTemplateShellProps) {
  const [tab, setTab] = useState<"cook" | "nutrition">("cook");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [moreOpen]);

  const sourceUrl = template.metadata.sourceUrl;
  const sourceLinkBase = sourceUrl ? getRecipeSourceLinkBase(sourceUrl) : null;
  const kcal = template.nutrition.caloriesDisplay;
  const heroSrc = template.imageUrl || "/images/recipe-placeholder.png";

  const handleShare = useCallback(async () => {
    const url = sourceUrl?.trim() || (typeof window !== "undefined" ? window.location.href : "");
    const title = template.title;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled or clipboard blocked */
    }
  }, [sourceUrl, template.title]);

  const openSource = () => {
    if (sourceUrl) window.open(sourceUrl, "_blank");
  };

  const viewFullImage = () => {
    if (template.imageUrl) window.open(template.imageUrl, "_blank");
  };

  return (
    <div className="recipe-template-shell" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button
          type="button"
          className="recipe-template-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close recipe"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}

      {onClose ? (
        <div className="recipe-template-mobile-bar">
          <button type="button" className="recipe-template-mobile-back" onClick={() => onClose()} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className="recipe-template-top">
        <div className="recipe-template-hero">
          <div className="recipe-template-hero-media">
            {sourceLinkBase ? (
              <a
                className="recipe-template-hero-link"
                {...sourceLinkBase}
                aria-label={getRecipeSourceColumnAriaLabel(template.title)}
                onClick={(e) => e.stopPropagation()}
              >
                <img className="recipe-template-hero-img" src={heroSrc} alt="" />
              </a>
            ) : (
              <img
                className="recipe-template-hero-img"
                src={heroSrc}
                alt={template.title}
              />
            )}
          </div>
          {heroOverlay}
          {template.imageUrl && !heroOverlay && (
            <button
              type="button"
              className="recipe-template-hero-view-full"
              onClick={(e) => {
                e.stopPropagation();
                viewFullImage();
              }}
            >
              View full size
            </button>
          )}
        </div>

        <div className="recipe-template-summary">
          {draftTitle ? (
            <input
              type="text"
              className="recipe-template-title recipe-template-title-input"
              value={draftTitle.value}
              onChange={(e) => draftTitle.onChange(e.target.value)}
              placeholder={draftTitle.placeholder ?? "Recipe name"}
              aria-label="Recipe name"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h1 className="recipe-template-title">{template.title}</h1>
          )}
          {(template.sourceLine || template.creatorLine) && (
            <p className="recipe-template-meta-line">
              {template.sourceLine || template.creatorLine}
            </p>
          )}
          {template.description && (
            <p className="recipe-template-desc">{template.description}</p>
          )}

          <div className="recipe-template-actions">
            {favoriteSlot && (
              <div className="recipe-template-favorite-wrap">{favoriteSlot}</div>
            )}
            {cookbookActionSlot}
            <button type="button" className="recipe-template-action-btn" onClick={() => handleShare()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
              </svg>
              Share
            </button>
            <div className="recipe-template-actions-relative" ref={moreRef}>
              <button
                type="button"
                className="recipe-template-action-btn recipe-template-action-more"
                aria-label="More"
                aria-expanded={moreOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreOpen((v) => !v);
                }}
              >
                ···
              </button>
              {moreOpen && (
                <div className="recipe-template-more-popover" role="menu">
                  {sourceUrl && (
                    <button type="button" className="recipe-template-more-item" role="menuitem" onClick={() => { setMoreOpen(false); openSource(); }}>
                      Open source link
                    </button>
                  )}
                  {onMoveToTrash ? (
                    <button
                      type="button"
                      className="recipe-template-more-item"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        void onMoveToTrash();
                      }}
                    >
                      Move to trash
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="recipe-template-more-item"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      window.print();
                    }}
                  >
                    Print recipe
                  </button>
                  <Link
                    href="/dashboard/about"
                    className={
                      nutritionDisclaimerMenuSubtext
                        ? "recipe-template-more-item recipe-template-more-item--stacked"
                        : "recipe-template-more-item"
                    }
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    <span className="recipe-template-more-item-title">Nutrition disclaimer</span>
                    {nutritionDisclaimerMenuSubtext ? (
                      <span className="recipe-template-more-item-sub">
                        {nutritionDisclaimerMenuSubtext}
                      </span>
                    ) : null}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="recipe-template-stats" aria-label="Recipe summary">
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconFlame /></div>
              <div className="recipe-template-stat-value" title={template.nutrition.caloriesTitle}>
                {kcal}
              </div>
              <div className="recipe-template-stat-label">Calories</div>
            </div>
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconProtein /></div>
              <div className="recipe-template-stat-value">{macroText(template.nutrition.proteinG)}</div>
              <div className="recipe-template-stat-label">Protein</div>
            </div>
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconCarb /></div>
              <div className="recipe-template-stat-value">{macroText(template.nutrition.carbG)}</div>
              <div className="recipe-template-stat-label">Carbs</div>
            </div>
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconFat /></div>
              <div className="recipe-template-stat-value">{macroText(template.nutrition.fatG)}</div>
              <div className="recipe-template-stat-label">Fat</div>
            </div>
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconClock /></div>
              <div className="recipe-template-stat-value">
                {template.times.totalMinutes > 0 ? `${template.times.totalMinutes} min` : "—"}
              </div>
              <div className="recipe-template-stat-label">Total time</div>
            </div>
            <div className="recipe-template-stat-card">
              <div className="recipe-template-stat-icon"><IconPeople /></div>
              <div className="recipe-template-stat-value">
                {template.servingsDisplay ?? "—"}
              </div>
              <div className="recipe-template-stat-label">Servings</div>
            </div>
          </div>
        </div>
      </div>

      <div className="recipe-template-tabs-wrap">
        <div className="recipe-template-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cook"}
            className={`recipe-template-tab${tab === "cook" ? " is-active" : ""}`}
            onClick={() => setTab("cook")}
          >
            Cook
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "nutrition"}
            className={`recipe-template-tab${tab === "nutrition" ? " is-active" : ""}`}
            onClick={() => setTab("nutrition")}
          >
            Nutrition &amp; Details
          </button>
        </div>
      </div>

      <div className="recipe-template-panel">
        {tab === "cook" && (
          <div className="recipe-template-cook-grid">
            <div className="recipe-template-panel-card recipe-template-ingredients-extra">
              {cookIngredientsPanel}
            </div>
            <div className="recipe-template-panel-card">{cookInstructionsPanel}</div>
          </div>
        )}
        {tab === "nutrition" && (
          <div className="recipe-template-panel-card">{nutritionPanel}</div>
        )}
      </div>

      {mobileSaveSlot && (
        <div className="recipe-template-sticky-cta">{mobileSaveSlot}</div>
      )}
    </div>
  );
}

/** Alias: same component, product-facing name. */
export const RecipeTemplateView = RecipeTemplateShell;
