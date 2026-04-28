"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { pickRecipeIngredientFdc } from "@/app/actions/recipes";
import {
  formatRecipeEnergyKcalDisplay,
  recipeNutritionSourceDetail,
} from "@/lib/nutrition/nutrition-display";
import type {
  FdcCandidateSnapshot,
  RecipeIngredientLineSnapshot,
  RecipeNutritionSnapshot,
  RecipeRow,
} from "@/lib/types";
import {
  getRecipeSourceLinkBase,
} from "@/lib/recipeSourceLink";
import { addGroceryItem, addGroceryItems, removeGroceryItems } from "@/app/actions/grocery-items";
import { buildRecipeTemplateData, isRecipeTemplateDraftRow } from "@/lib/recipe-template";
import { RecipeTemplateShell } from "@/components/RecipeTemplateShell";
import { HeartButton } from "@/components/HeartButton";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import {
  canSaveRecipeToCookbook,
  recipeRowToProcessed,
  toRecipePayload,
} from "@/lib/processRecipeData";
import "@/app/styling/RecipeFullView.css";

const INGREDIENT_PREVIEW_COUNT = 10;

type RecipeFullViewProps = {
  recipeData: RecipeRow;
  onClose?: () => void;
  isHearted?: boolean;
  onFavoriteChange?: (recipe: RecipeRow, isFavorited: boolean) => void;
  /** Optional primary action in header (e.g. Save to cookbook for URL draft preview). */
  primaryActionSlot?: React.ReactNode;
  /** Hide heart even for persisted rows (used by create-recipe draft preview). */
  hideFavoriteAction?: boolean;
  /** Optional overlay rendered inside recipe hero image area. */
  heroOverlay?: React.ReactNode;
  /** Editable title on the card (e.g. create-recipe draft); sync with form state in parent. */
  draftTitle?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Subtext under ⋯ → Nutrition disclaimer (e.g. unsaved draft warning). */
  nutritionDisclaimerMenuSubtext?: string;
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

export function RecipeFullView({
  recipeData,
  onClose,
  isHearted = false,
  onFavoriteChange,
  primaryActionSlot,
  hideFavoriteAction = false,
  heroOverlay,
  draftTitle,
  nutritionDisclaimerMenuSubtext,
}: RecipeFullViewProps) {
  const router = useRouter();
  const template = useMemo(() => buildRecipeTemplateData(recipeData), [recipeData]);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const [groceryFeedback, setGroceryFeedback] = useState<string | null>(null);
  const [addAllBusy, setAddAllBusy] = useState(false);
  const [addAllDone, setAddAllDone] = useState(false);
  const [lastAddedItems, setLastAddedItems] = useState<string[]>([]);
  const [fdcPickLine, setFdcPickLine] = useState<number | null>(null);
  const [fdcPickChoice, setFdcPickChoice] = useState<number | null>(null);
  const [fdcPickBusy, setFdcPickBusy] = useState(false);
  const [fdcPickError, setFdcPickError] = useState<string | null>(null);
  const [saveCookbookOpen, setSaveCookbookOpen] = useState(false);

  const ingredientLines = (recipeData.ingredient_lines ?? "").split("***").map((s) => s.trim()).filter(Boolean);
  const stepsLines = (recipeData.steps ?? "").trim()
    ? (recipeData.steps ?? "").split("***").map((s) => s.trim()).filter(Boolean)
    : [];
  const sourceUrl = recipeData.website_url?.trim() || null;

  const nutritionSnap = pickNutritionSnapshot(recipeData);
  const lineNutritionMap = lineNutritionByIndex(recipeData);
  const energyDisplay = formatRecipeEnergyKcalDisplay(recipeData);
  const src = nutritionSnap?.nutrition_source ?? "incomplete";
  const nutritionSourceLabel =
    src === "fdc"
      ? "USDA"
      : src === "estimated"
        ? "Estimated"
        : src === "mixed"
          ? "Mixed"
          : "Incomplete";

  const draft = isRecipeTemplateDraftRow(recipeData);
  const showFavorite = !draft && !hideFavoriteAction;
  const cookbookSavePayload = useMemo(() => {
    if (!canSaveRecipeToCookbook(recipeData)) return null;
    return toRecipePayload(recipeRowToProcessed(recipeData));
  }, [recipeData]);
  const showCookbookSave = cookbookSavePayload != null;

  const ingredientRows = template.ingredients;
  const visibleIngredients =
    ingredientsExpanded || ingredientRows.length <= INGREDIENT_PREVIEW_COUNT
      ? ingredientRows
      : ingredientRows.slice(0, INGREDIENT_PREVIEW_COUNT);

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

  const heartProps = {
    recipeData: recipeRowToProcessed(recipeData),
    heartStyle: {} as CSSProperties,
    isHearted,
    recipe: recipeData,
    onFavoriteChange,
  };

  const favoriteSlot = showFavorite
    ? <HeartButton {...heartProps} />
    : (primaryActionSlot ?? undefined);
  const mobileFavoriteSlot = showFavorite ? (
    <HeartButton {...heartProps} heartStyle={{ transform: "scale(1.2)" }} />
  ) : undefined;

  const cookIngredientsPanel = (
    <>
      <div className="recipe-template-panel-head">
        <h2 className="recipe-template-panel-title">
          <span aria-hidden>🛒</span> Ingredients
        </h2>
        {ingredientLines.length > 0 && (
          <button
            type="button"
            className="recipe-template-link-accent"
            onClick={(e) => {
              e.stopPropagation();
              handleAddAllIngredients();
            }}
            disabled={addAllDone || addAllBusy}
          >
            {addAllDone ? "Added" : addAllBusy ? "Adding…" : "+ Add to grocery list"}
          </button>
        )}
      </div>
      {ingredientLines.length > 0 && (addAllDone || addAllBusy) && (
        <div className="recipe-fullview-grocery-actions" style={{ marginBottom: 8 }}>
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
              Undo add all
            </button>
          )}
        </div>
      )}
      {groceryFeedback && (
        <p role="status" className="recipe-fullview-grocery-feedback">
          {groceryFeedback}
        </p>
      )}
      <ul className="recipe-ingredients-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {visibleIngredients.length > 0 ? (
          visibleIngredients.map((ing) => {
            const index = ing.lineIndex;
            const item = ing.rawText;
            const lineSnap = lineNutritionMap.get(index);
            const nutBadge = lineNutritionBadge(lineSnap);
            const fdcCandidates = parseFdcCandidates(lineSnap?.fdc_candidates);
            const showFdcPicker = fdcCandidates.length > 0 && fdcPickLine === index;
            return (
              <li key={index} className="recipe-template-ingredient-row">
                <input type="checkbox" aria-label={`Got ${ing.displayName || item}`} />
                <span className="recipe-template-ingredient-name">{ing.displayName || item}</span>
                <span className="recipe-template-ingredient-qty">{ing.displayQuantity || ""}</span>
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
                  title={`Add ${item} to grocery list`}
                  aria-label={`Add ${item} to grocery list`}
                >
                  <AddToGroceryIcon />
                </button>
                {showFdcPicker && (
                  <div
                    className="recipe-ingredient-fdc-pick-panel"
                    style={{ gridColumn: "1 / -1" }}
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
      {ingredientRows.length > INGREDIENT_PREVIEW_COUNT && (
        <button
          type="button"
          className="recipe-template-show-more"
          onClick={() => setIngredientsExpanded((v) => !v)}
        >
          {ingredientsExpanded ? "Show fewer ingredients" : "Show more ingredients"}
        </button>
      )}
    </>
  );

  const cookInstructionsPanel = (
    <>
      <div className="recipe-template-panel-head">
        <h2 className="recipe-template-panel-title">
          <span aria-hidden>👨‍🍳</span> Instructions
        </h2>
      </div>
      {stepsLines.length > 0 ? (
        <ol className="recipe-template-steps-list">
          {stepsLines.map((step, index) => (
            <li key={index} className="recipe-template-step-card">
              <span className="recipe-template-step-num">{index + 1}</span>
              <span className="recipe-template-step-text">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="recipe-steps-empty">No steps listed.</p>
      )}
    </>
  );

  const nutritionPanel = (
    <>
      <div className="recipe-template-panel-head">
        <h2 className="recipe-template-panel-title">Nutrition</h2>
      </div>
      <div className="recipe-template-nutrition-macros">
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-icon">
            <span aria-hidden>🔥</span>
          </div>
          <div className="recipe-template-stat-value" title={energyDisplay.title}>
            {energyDisplay.kcalText}
          </div>
          <div className="recipe-template-stat-label">Calories</div>
        </div>
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-value">
            {nutritionSnap ? `${Number(nutritionSnap.protein_g).toFixed(0)}g` : "—"}
          </div>
          <div className="recipe-template-stat-label">Protein</div>
        </div>
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-value">
            {nutritionSnap ? `${Number(nutritionSnap.carb_g).toFixed(0)}g` : "—"}
          </div>
          <div className="recipe-template-stat-label">Carbs</div>
        </div>
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-value">
            {nutritionSnap ? `${Number(nutritionSnap.fat_g).toFixed(0)}g` : "—"}
          </div>
          <div className="recipe-template-stat-label">Fat</div>
        </div>
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-value">{template.nutrition.fiberG != null ? `${template.nutrition.fiberG}g` : "—"}</div>
          <div className="recipe-template-stat-label">Fiber</div>
        </div>
        <div className="recipe-template-stat-card">
          <div className="recipe-template-stat-value">{template.nutrition.sugarG != null ? `${template.nutrition.sugarG}g` : "—"}</div>
          <div className="recipe-template-stat-label">Sugar</div>
        </div>
      </div>
      <p
        className={`recipe-fullview-nutrition-source recipe-fullview-nutrition-source--${src}`}
        title={recipeNutritionSourceDetail(recipeData, src)}
        style={{ marginBottom: 16 }}
      >
        Nutrition: {nutritionSourceLabel}
      </p>

      <div className="recipe-template-nutrition-meta">
        <h3 className="recipe-template-panel-title" style={{ fontSize: "15px", marginBottom: 8 }}>
          Recipe details
        </h3>
        <dl className="recipe-template-meta-dl">
          <dt className="recipe-template-meta-dt">Prep time</dt>
          <dd className="recipe-template-meta-dd">
            {template.times.prepMinutes != null ? `${template.times.prepMinutes} min` : "—"}
          </dd>
          <dt className="recipe-template-meta-dt">Cook time</dt>
          <dd className="recipe-template-meta-dd">{template.times.cookMinutes} min</dd>
          <dt className="recipe-template-meta-dt">Total time</dt>
          <dd className="recipe-template-meta-dd">{template.times.totalMinutes} min</dd>
          <dt className="recipe-template-meta-dt">Servings</dt>
          <dd className="recipe-template-meta-dd">{template.servingsDisplay ?? "—"}</dd>
          <dt className="recipe-template-meta-dt">Cuisine</dt>
          <dd className="recipe-template-meta-dd">{template.metadata.cuisine ?? "—"}</dd>
          <dt className="recipe-template-meta-dt">Meal type</dt>
          <dd className="recipe-template-meta-dd">{template.metadata.mealType ?? "—"}</dd>
          <dt className="recipe-template-meta-dt">Difficulty</dt>
          <dd className="recipe-template-meta-dd">{template.metadata.difficulty ?? "—"}</dd>
          <dt className="recipe-template-meta-dt">Source URL</dt>
          <dd className="recipe-template-meta-dd">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Open link
              </a>
            ) : (
              "—"
            )}
            </dd>
          <dt className="recipe-template-meta-dt">Creator</dt>
          <dd className="recipe-template-meta-dd">{template.metadata.creatorLine ?? "—"}</dd>
        </dl>
      </div>

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

      {lineNutritionMap.size > 0 && (
        <>
          <h3 className="recipe-template-panel-title" style={{ fontSize: "15px", margin: "20px 0 8px" }}>
            Ingredient nutrition confidence
          </h3>
          <ul className="recipe-ingredients-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ingredientLines.map((item, index) => {
              const lineSnap = lineNutritionMap.get(index);
              const nutBadge = lineNutritionBadge(lineSnap);
              return (
                <li key={index} className="recipe-ingredient-item recipe-ingredient-item-with-add">
                  <span className="recipe-ingredient-text">{item}</span>
                  <span
                    className={`recipe-ingredient-nut-badge recipe-ingredient-nut-badge--${nutBadge.classSuffix}`}
                    title={nutBadge.title}
                  >
                    {nutBadge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {sourceUrl && getRecipeSourceLinkBase(sourceUrl) && (
        <button
          type="button"
          className="recipe-fullview-openlink-btn"
          style={{ marginTop: 20 }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(sourceUrl, "_blank");
          }}
        >
          Open original recipe
        </button>
      )}
    </>
  );

  const cookbookActionSlot = showCookbookSave ? (
    <button
      type="button"
      className="recipe-template-action-btn recipe-template-cookbook-action"
      aria-label="Add to cookbook"
      onClick={(e) => {
        e.stopPropagation();
        setSaveCookbookOpen(true);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8M8 11h6" />
      </svg>
      <span className="recipe-template-cookbook-action-text">Add to cookbook</span>
    </button>
  ) : undefined;

  return (
    <>
      <RecipeTemplateShell
        template={template}
        onClose={onClose}
        favoriteSlot={favoriteSlot}
        cookbookActionSlot={cookbookActionSlot}
        mobileSaveSlot={
          mobileFavoriteSlot ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                padding: "12px 16px",
                background: "var(--accent)",
                borderRadius: 14,
              }}
            >
              {mobileFavoriteSlot}
            </div>
          ) : undefined
        }
        cookIngredientsPanel={cookIngredientsPanel}
        cookInstructionsPanel={cookInstructionsPanel}
        nutritionPanel={nutritionPanel}
        heroOverlay={heroOverlay}
        draftTitle={draftTitle}
        nutritionDisclaimerMenuSubtext={nutritionDisclaimerMenuSubtext}
      />
      {showCookbookSave && cookbookSavePayload && (
        <SaveRecipeToCookbookModal
          open={saveCookbookOpen}
          onClose={() => setSaveCookbookOpen(false)}
          payload={saveCookbookOpen ? cookbookSavePayload : null}
        />
      )}
    </>
  );
}
