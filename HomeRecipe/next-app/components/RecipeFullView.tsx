"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { pickRecipeIngredientFdc } from "@/app/actions/recipes";
import { recipeDisplayEnergyKcal } from "@/lib/recipe-select";
import type {
  FdcCandidateSnapshot,
  RecipeIngredientLineSnapshot,
  RecipeNutritionSnapshot,
  RecipeRow,
} from "@/lib/types";
import {
  getRecipeSourceColumnAriaLabel,
  getRecipeSourceLinkBase,
} from "@/lib/recipeSourceLink";
import { addGroceryItem, addGroceryItems, removeGroceryItems } from "@/app/actions/grocery-items";
import "@/app/styling/RecipeFullView.css";

function capitalizeFirstLetter(string: string): string {
  if (string.includes("/")) {
    string = string.replace(/\/(.)/g, (_, char: string) => `/${char.toUpperCase()}`);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

type RecipeFullViewProps = {
  recipeData: RecipeRow;
  onClose?: () => void;
};

function pickNutritionSnapshot(
  row: RecipeRow
): RecipeNutritionSnapshot | null {
  const raw = row.recipe_nutrition;
  if (!raw) return null;
  const n = Array.isArray(raw) ? raw[0] : raw;
  if (!n || typeof n !== "object") return null;
  return n as RecipeNutritionSnapshot;
}

function parseFdcCandidates(
  raw: RecipeIngredientLineSnapshot["fdc_candidates"]
): FdcCandidateSnapshot[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: FdcCandidateSnapshot[] = [];
  for (const x of raw) {
    if (
      x &&
      typeof x === "object" &&
      typeof (x as FdcCandidateSnapshot).fdc_id === "number" &&
      typeof (x as FdcCandidateSnapshot).description === "string"
    ) {
      out.push(x as FdcCandidateSnapshot);
    }
  }
  return out;
}

function lineNutritionByIndex(row: RecipeRow): Map<number, RecipeIngredientLineSnapshot> {
  const raw = row.recipe_ingredient_lines;
  if (!raw) return new Map();
  const arr = Array.isArray(raw) ? raw : [raw];
  const m = new Map<number, RecipeIngredientLineSnapshot>();
  for (const entry of arr) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as RecipeIngredientLineSnapshot).line_index === "number"
    ) {
      const line = entry as RecipeIngredientLineSnapshot;
      m.set(line.line_index, line);
    }
  }
  return m;
}

function lineNutritionBadge(line: RecipeIngredientLineSnapshot | undefined): {
  label: string;
  classSuffix: "fdc" | "estimated" | "unresolved";
  title?: string;
} {
  const src = line?.line_nutrition_source ?? "unresolved";
  if (src === "fdc") {
    return { label: "USDA", classSuffix: "fdc", title: "Matched to USDA FoodData Central" };
  }
  if (src === "estimated") {
    return {
      label: "Est.",
      classSuffix: "estimated",
      title: line?.estimation_reason?.trim() || "Estimated nutrition",
    };
  }
  return {
    label: "—",
    classSuffix: "unresolved",
    title: line?.estimation_reason?.trim() || "Not included in nutrition total",
  };
}

function AddToGroceryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="10" y1="10" x2="14" y2="10" />
    </svg>
  );
}

function ViewSourceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v7h-7" />
      <path d="M3 10V3h7" />
      <path d="M3 21h7v-7" />
      <path d="M3 3l7 7" />
    </svg>
  );
}

export function RecipeFullView({ recipeData, onClose }: RecipeFullViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">("ingredients");
  const [groceryFeedback, setGroceryFeedback] = useState<string | null>(null);
  const [addAllBusy, setAddAllBusy] = useState(false);
  const [addAllDone, setAddAllDone] = useState(false);
  const [lastAddedItems, setLastAddedItems] = useState<string[]>([]);
  const [fdcPickLine, setFdcPickLine] = useState<number | null>(null);
  const [fdcPickChoice, setFdcPickChoice] = useState<number | null>(null);
  const [fdcPickBusy, setFdcPickBusy] = useState(false);
  const [fdcPickError, setFdcPickError] = useState<string | null>(null);
  const ingredientLines = (recipeData.ingredient_lines ?? "").split("***").map((s) => s.trim()).filter(Boolean);
  const stepsLines = (recipeData.steps ?? "").trim()
    ? (recipeData.steps ?? "").split("***").map((s) => s.trim()).filter(Boolean)
    : [];
  const cookMinutes = recipeData.time_in_minutes < 1 ? 1 : recipeData.time_in_minutes;
  const cookTimeTone =
    cookMinutes < 10 ? "fast" : cookMinutes > 30 ? "slow" : "medium";
  const sourceUrl = recipeData.website_url?.trim() || null;
  const sourceLinkBase = sourceUrl ? getRecipeSourceLinkBase(sourceUrl) : null;

  const nutritionSnap = pickNutritionSnapshot(recipeData);
  const lineNutritionMap = lineNutritionByIndex(recipeData);
  const displayKcal = recipeDisplayEnergyKcal(recipeData);
  const src = nutritionSnap?.nutrition_source ?? "incomplete";
  const nutritionSourceLabel =
    src === "fdc"
      ? "USDA"
      : src === "estimated"
        ? "Estimated"
        : src === "mixed"
          ? "Mixed"
          : "Incomplete";

  async function handleAddIngredient(item: string) {
    const res = await addGroceryItem(item);
    if (res.error) {
      setGroceryFeedback(res.error);
    } else if (res.duplicate) {
      setGroceryFeedback("Already in list");
    } else {
      setGroceryFeedback("Added");
    }
    setTimeout(() => setGroceryFeedback(null), 2000);
  }

  async function handleAddAllIngredients() {
    if (addAllDone || addAllBusy) return;
    setAddAllBusy(true);
    const res = await addGroceryItems(ingredientLines);
    if (res.error) {
      setGroceryFeedback(res.error);
    } else if (res.added === 0 && res.skipped > 0) {
      setGroceryFeedback("All already in list");
    } else if (res.added > 0) {
      setAddAllDone(true);
      setLastAddedItems(res.addedItems ?? []);
      setGroceryFeedback(null);
    }
    setAddAllBusy(false);
    setTimeout(() => setGroceryFeedback(null), 2000);
  }

  async function handleConfirmFdcPick(lineIndex: number) {
    if (fdcPickChoice == null || fdcPickBusy) return;
    setFdcPickBusy(true);
    setFdcPickError(null);
    const res = await pickRecipeIngredientFdc({
      recipeId: recipeData.id,
      lineIndex,
      fdcId: fdcPickChoice,
    });
    setFdcPickBusy(false);
    if (res.error) {
      setFdcPickError(res.error);
      return;
    }
    setFdcPickLine(null);
    setFdcPickChoice(null);
    router.refresh();
  }

  async function handleUndoAddAll() {
    if (addAllBusy || lastAddedItems.length === 0) return;
    setAddAllBusy(true);
    const res = await removeGroceryItems(lastAddedItems);
    if (res.error) {
      setGroceryFeedback(res.error);
      setTimeout(() => setGroceryFeedback(null), 2000);
      setAddAllBusy(false);
      return;
    }
    setAddAllDone(false);
    setLastAddedItems([]);
    setAddAllBusy(false);
  }

  return (
    <div className="more-information-container" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button
          type="button"
          className="recipe-fullview-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close recipe"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
      {sourceLinkBase ? (
        <a
          className="more-information-image-box more-information-image-box--source-link"
          {...sourceLinkBase}
          aria-label={getRecipeSourceColumnAriaLabel(recipeData.recipe_label)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="more-info-image-blur" />
          {recipeData.image_url ? (
            <img
              className="more-info-image"
              src={recipeData.image_url}
              alt=""
              aria-hidden
            />
          ) : (
            <img
              className="more-info-image more-info-image-placeholder"
              src="/images/recipe-placeholder.png"
              alt=""
              aria-hidden
            />
          )}
          <h1 className="more-info-recipe-label">{recipeData.recipe_label}</h1>
        </a>
      ) : (
        <div className="more-information-image-box">
          <div className="more-info-image-blur" />
          {recipeData.image_url ? (
            <img
              className="more-info-image"
              src={recipeData.image_url}
              alt={recipeData.recipe_label}
            />
          ) : (
            <img
              className="more-info-image more-info-image-placeholder"
              src="/images/recipe-placeholder.png"
              alt=""
              aria-hidden
            />
          )}
          <h1 className="more-info-recipe-label">{recipeData.recipe_label}</h1>
        </div>
      )}
      <div className="full-information">
        <div className="bubble-content">
          <div className="recipe-fullview-pill-row">
            {recipeData.cuisine_type && <p>{capitalizeFirstLetter(recipeData.cuisine_type)}</p>}
            {recipeData.meal_type && <p>{capitalizeFirstLetter(recipeData.meal_type)}</p>}
            <p className={`recipe-fullview-cooktime-pill recipe-fullview-cooktime-pill--${cookTimeTone}`}>
              {cookMinutes} min
            </p>
          </div>
          <div className="recipe-fullview-nutrition" aria-label="Nutrition summary">
            <p className="recipe-fullview-nutrition-macros">
              <span className="recipe-fullview-nutrition-kcal">{displayKcal} kcal</span>
              {nutritionSnap && (
                <>
                  <span>· P {Number(nutritionSnap.protein_g).toFixed(1)}g</span>
                  <span>· F {Number(nutritionSnap.fat_g).toFixed(1)}g</span>
                  <span>· C {Number(nutritionSnap.carb_g).toFixed(1)}g</span>
                </>
              )}
            </p>
            <p
              className={`recipe-fullview-nutrition-source recipe-fullview-nutrition-source--${src}`}
            >
              Nutrition: {nutritionSourceLabel}
            </p>
            <p className="recipe-fullview-fdc-attribution">
              Data:{" "}
              <a
                href="https://fdc.nal.usda.gov/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                USDA FoodData Central
              </a>{" "}
              (public domain).{" "}
              <Link
                href="/dashboard/about"
                className="recipe-fullview-fdc-attribution-more"
                onClick={(e) => e.stopPropagation()}
              >
                More
              </Link>
            </p>
          </div>
          {sourceLinkBase && (
            <a
              {...sourceLinkBase}
              className="recipe-fullview-view-source"
              onClick={(e) => e.stopPropagation()}
            >
              <ViewSourceIcon />
              View source
            </a>
          )}
        </div>
        <div className="recipe-fullview-tabs">
          <button
            type="button"
            className={`recipe-fullview-tab ${activeTab === "ingredients" ? "active" : ""}`}
            onClick={() => setActiveTab("ingredients")}
          >
            Ingredients
          </button>
          <button
            type="button"
            className={`recipe-fullview-tab ${activeTab === "steps" ? "active" : ""}`}
            onClick={() => setActiveTab("steps")}
          >
            Steps
          </button>
        </div>
        <div className="recipe-fullview-tab-panel">
          {activeTab === "ingredients" && (
            <section className="recipe-section recipe-section-ingredients">
              {ingredientLines.length > 0 && (
                <div className="recipe-fullview-grocery-actions">
                  <button
                    type="button"
                    className={`recipe-fullview-add-all-grocery ${addAllDone ? "is-done" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddAllIngredients();
                    }}
                    disabled={addAllDone || addAllBusy}
                  >
                    {addAllDone ? "Added to grocery list" : addAllBusy ? "Adding..." : "Add all to grocery list"}
                  </button>
                  {addAllDone && (
                    <button
                      type="button"
                      className="recipe-fullview-undo-grocery"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUndoAddAll();
                      }}
                      disabled={addAllBusy}
                    >
                      Undo
                    </button>
                  )}
                </div>
              )}
              {groceryFeedback && (
                <p role="status" className="recipe-fullview-grocery-feedback">
                  {groceryFeedback}
                </p>
              )}
              <ul className="recipe-ingredients-list">
                {ingredientLines.length > 0 ? (
                  ingredientLines.map((item, index) => {
                    const lineSnap = lineNutritionMap.get(index);
                    const nutBadge = lineNutritionBadge(lineSnap);
                    const fdcCandidates = parseFdcCandidates(lineSnap?.fdc_candidates);
                    const showFdcPicker =
                      fdcCandidates.length > 0 && fdcPickLine === index;
                    return (
                    <li key={index} className="recipe-ingredient-item recipe-ingredient-item-with-add">
                      <span className="recipe-ingredient-text">{item}</span>
                      {lineNutritionMap.size > 0 && (
                        <span
                          className={`recipe-ingredient-nut-badge recipe-ingredient-nut-badge--${nutBadge.classSuffix}`}
                          title={nutBadge.title}
                        >
                          {nutBadge.label}
                        </span>
                      )}
                      {fdcCandidates.length > 0 && (
                        <button
                          type="button"
                          className="recipe-ingredient-fdc-pick-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFdcPickError(null);
                            if (fdcPickLine === index) {
                              setFdcPickLine(null);
                              setFdcPickChoice(null);
                            } else {
                              setFdcPickLine(index);
                              setFdcPickChoice(fdcCandidates[0]?.fdc_id ?? null);
                            }
                          }}
                        >
                          {fdcPickLine === index ? "Cancel" : "Pick food"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="recipe-ingredient-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddIngredient(item);
                        }}
                        aria-label={`Add ${item} to grocery list`}
                      >
                        <AddToGroceryIcon />
                      </button>
                      {showFdcPicker && (
                        <div
                          className="recipe-ingredient-fdc-pick-panel"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="recipe-ingredient-fdc-pick-hint">
                            Choose the USDA food that best matches this line:
                          </p>
                          <ul className="recipe-ingredient-fdc-pick-list">
                            {fdcCandidates.map((c) => (
                              <li key={c.fdc_id}>
                                <label className="recipe-ingredient-fdc-pick-option">
                                  <input
                                    type="radio"
                                    name={`fdc-pick-${index}`}
                                    checked={fdcPickChoice === c.fdc_id}
                                    onChange={() => setFdcPickChoice(c.fdc_id)}
                                  />
                                  <span>{c.description}</span>
                                  <span className="recipe-ingredient-fdc-pick-id">FDC {c.fdc_id}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                          {fdcPickError && (
                            <p role="alert" className="recipe-ingredient-fdc-pick-err">
                              {fdcPickError}
                            </p>
                          )}
                          <button
                            type="button"
                            className="recipe-ingredient-fdc-pick-confirm"
                            disabled={fdcPickChoice == null || fdcPickBusy}
                            onClick={() => handleConfirmFdcPick(index)}
                          >
                            {fdcPickBusy ? "Saving…" : "Use selected food"}
                          </button>
                        </div>
                      )}
                    </li>
                    );
                  })
                ) : (
                  <li className="recipe-ingredient-item recipe-empty-hint">No ingredients listed.</li>
                )}
              </ul>
            </section>
          )}
          {activeTab === "steps" && (
            <section className="recipe-section recipe-section-steps">
              {stepsLines.length > 0 ? (
                <ol className="recipe-steps-list">
                  {stepsLines.map((step, index) => (
                    <li key={index} className="recipe-step-item">
                      <span className="recipe-step-num">{index + 1}</span>
                      <span className="recipe-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="recipe-steps-empty">No steps listed.</p>
              )}
            </section>
          )}
        </div>
        {sourceUrl && (
          <button
            type="button"
            className="recipe-fullview-openlink-btn"
            onClick={(e) => {
              e.stopPropagation();
              window.open(sourceUrl, "_blank");
            }}
          >
            <svg className="openlink-icon" width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M313.226 2.70261C305.244 6.93305 301.135 13.6312 300.665 23.2672C300.196 33.0208 303.131 39.4839 310.761 45.1245L315.926 48.7674L365.349 49.1199L414.772 49.4725L306.065 158.406C228.938 235.612 196.654 268.868 194.776 272.511C192.663 276.624 192.311 279.209 192.663 285.084C193.132 293.428 196.654 299.538 203.698 304.239C208.746 307.764 219.311 308.822 226.003 306.707C229.759 305.532 251.242 284.614 340.697 195.305L450.695 85.1962V133.259V181.204L453.747 186.962C455.508 190.017 459.029 194.13 461.612 195.893C465.838 198.83 467.364 199.183 475.465 199.183C483.682 199.183 484.974 198.83 489.552 195.658C492.252 193.66 495.774 189.782 497.3 186.962L500 181.791V99.8852V17.9792L497.3 12.8087C495.774 9.98836 492.252 5.99295 489.552 4.11275L484.504 0.587387L401.507 0.23485L318.509 -0.000174327L313.226 2.70261Z" fill="var(--color-bg)" />
              <path d="M56.258 77.0731C35.4793 82.4786 16.9311 97.6377 7.53959 116.91C-0.560585 133.361 -0.208404 123.255 0.143777 290.945L0.495959 442.419L3.5482 450.292C12.2353 472.619 27.8487 488.248 50.1535 496.944L58.0189 500H211.218H364.417L372.634 497.414C394.704 490.364 412.196 473.442 421.235 450.292L424.288 442.419L424.64 355.812C424.992 272.026 424.875 268.971 422.644 264.74C412.9 245.586 387.543 245.586 377.8 264.623C375.687 268.853 375.569 272.613 375.569 347.821C375.569 404.345 375.217 428.2 374.161 432.195C372.282 439.716 364.065 447.942 356.551 449.822C348.686 451.82 76.0976 451.82 68.2322 449.822C60.719 447.942 52.5014 439.716 50.6231 432.195C49.5666 428.082 49.2144 390.243 49.2144 287.537C49.2144 130.424 48.6274 140.06 58.0189 131.834C61.1886 129.131 65.4147 126.663 68.5844 125.841C72.1062 125.018 98.4024 124.548 152.169 124.548C226.01 124.548 230.823 124.313 235.284 122.315C254.536 113.384 254.771 87.2966 235.636 77.4256C231.41 75.3104 227.653 75.1929 147.003 75.3104C77.5063 75.3104 61.5407 75.6629 56.258 77.0731Z" fill="var(--color-bg)" />
            </svg>
            Show Recipe
          </button>
        )}
      </div>
    </div>
  );
}
