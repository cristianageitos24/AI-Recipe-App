"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRecipeAndReturn } from "@/app/actions/recipes";
import { RecipeFullView } from "@/components/RecipeFullView";
import { SaveToFolderButton } from "@/components/SaveToFolderButton";
import { buildManualRecipePayload, recipeRowToProcessed } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/CookbookPageRecipeCard.css";

export default function CreateRecipePage() {
  const router = useRouter();
  const [createdRecipe, setCreatedRecipe] = useState<RecipeRow | null>(null);

  const [manualRecipeLabel, setManualRecipeLabel] = useState("");
  const [manualAddRecipeTab, setManualAddRecipeTab] = useState<
    "ingredients" | "cooktime" | "steps"
  >("ingredients");
  const [manualIngredientLines, setManualIngredientLines] = useState<string[]>([""]);
  const [manualStepsLines, setManualStepsLines] = useState<string[]>([""]);
  const [manualTimeInMinutes, setManualTimeInMinutes] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualCuisineType, setManualCuisineType] = useState("");
  const [manualMealType, setManualMealType] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualWebsiteUrl, setManualWebsiteUrl] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  function clearError() {
    setManualError("");
  }

  function getManualFormValid(): boolean {
    const label = manualRecipeLabel.trim();
    const ingredients = manualIngredientLines.map((s) => s.trim()).filter(Boolean);
    const time = Number(manualTimeInMinutes);
    return (
      label.length > 0 &&
      ingredients.length > 0 &&
      Number.isFinite(time) &&
      time >= 1
    );
  }

  function resetToForm() {
    setCreatedRecipe(null);
    setManualRecipeLabel("");
    setManualAddRecipeTab("ingredients");
    setManualIngredientLines([""]);
    setManualStepsLines([""]);
    setManualTimeInMinutes("");
    setManualCalories("");
    setManualCuisineType("");
    setManualMealType("");
    setManualImageUrl("");
    setManualWebsiteUrl("");
    setManualError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    if (!getManualFormValid()) {
      setManualError(
        "Recipe name, at least one ingredient, and a cook time of at least 1 minute are required."
      );
      return;
    }
    setManualSubmitting(true);
    try {
      const ingredientsText = manualIngredientLines
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n");
      const stepsText =
        manualStepsLines
          .map((s) => s.trim())
          .filter(Boolean)
          .join("\n") || undefined;
      const payload = buildManualRecipePayload({
        recipeLabel: manualRecipeLabel,
        ingredientsText,
        stepsText,
        timeInMinutes: Number(manualTimeInMinutes) || 0,
        calories: manualCalories ? Number(manualCalories) : undefined,
        cuisineType: manualCuisineType || undefined,
        mealType: manualMealType || undefined,
        imageUrl: manualImageUrl || undefined,
        websiteUrl: manualWebsiteUrl || undefined,
      });
      const res = await createRecipeAndReturn(payload);
      if (res.error) {
        setManualError(res.error);
        return;
      }
      if (res.data) setCreatedRecipe(res.data);
    } finally {
      setManualSubmitting(false);
    }
  }

  if (createdRecipe) {
    return (
      <div
        className="recipe-full-view-overlay"
        onClick={() => router.push("/dashboard/home")}
        onKeyDown={(e) => e.key === "Escape" && router.push("/dashboard/home")}
        role="button"
        tabIndex={0}
      >
        <div
          className="recipe-full-view-scroll-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-4)",
            }}
          >
            <Link
              href="/dashboard/home"
              className="add-recipe-manual-submit"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Back to Home
            </Link>
            <button
              type="button"
              onClick={resetToForm}
              className="add-recipe-manual-submit"
              style={{ background: "var(--gray-600)" }}
            >
              Create another recipe
            </button>
            <SaveToFolderButton
              folders={[]}
              recipeData={recipeRowToProcessed(createdRecipe)}
            />
          </div>
          <RecipeFullView
            recipeData={createdRecipe}
            onClose={() => router.push("/dashboard/home")}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="main-panel" style={{ maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 28, color: "var(--color-fg)" }}>
        Create Recipe
      </h1>
      <p
        style={{
          marginTop: 8,
          marginBottom: 24,
          color: "var(--gray-700)",
          fontSize: "var(--text-sm)",
        }}
      >
        Fill in the details below to add a new recipe. You can then save it to a
        cookbook.
      </p>
      <form
        className="add-recipe-manual-form manual-recipe-tabbed-form"
        onSubmit={handleSubmit}
      >
        {manualError && (
          <p className="add-recipe-manual-error" role="alert">
            {manualError}
          </p>
        )}
        <label className="add-recipe-manual-label" htmlFor="create-recipe-name">
          Recipe name <span className="add-recipe-manual-required">*</span>
        </label>
        <input
          id="create-recipe-name"
          type="text"
          className="add-recipe-manual-input manual-recipe-title-input"
          placeholder="e.g. Chocolate Cake"
          value={manualRecipeLabel}
          onChange={(e) => {
            setManualRecipeLabel(e.target.value);
            clearError();
          }}
          aria-required
        />
        <div className="manual-recipe-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={manualAddRecipeTab === "ingredients"}
            className={`manual-recipe-tab ${manualAddRecipeTab === "ingredients" ? "active" : ""}`}
            onClick={() => setManualAddRecipeTab("ingredients")}
          >
            Ingredients
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manualAddRecipeTab === "cooktime"}
            className={`manual-recipe-tab ${manualAddRecipeTab === "cooktime" ? "active" : ""}`}
            onClick={() => setManualAddRecipeTab("cooktime")}
          >
            Cook time
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manualAddRecipeTab === "steps"}
            className={`manual-recipe-tab ${manualAddRecipeTab === "steps" ? "active" : ""}`}
            onClick={() => setManualAddRecipeTab("steps")}
          >
            Steps
          </button>
        </div>
        <div className="manual-recipe-tab-panel" role="tabpanel">
          {manualAddRecipeTab === "ingredients" && (
            <div className="manual-recipe-ingredients">
              {manualIngredientLines.map((line, i) => (
                <div key={i} className="manual-recipe-line-row">
                  <input
                    type="text"
                    className="add-recipe-manual-input manual-recipe-line-input"
                    value={line}
                    onChange={(e) => {
                      const next = [...manualIngredientLines];
                      next[i] = e.target.value;
                      setManualIngredientLines(next);
                      clearError();
                    }}
                    placeholder="Ingredient"
                    aria-label={`Ingredient ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="manual-recipe-remove-btn"
                    onClick={() => {
                      const next = manualIngredientLines.filter(
                        (_, idx) => idx !== i
                      );
                      setManualIngredientLines(
                        next.length === 0 ? [""] : next
                      );
                    }}
                    aria-label="Remove ingredient"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="manual-recipe-add-btn"
                onClick={() =>
                  setManualIngredientLines([...manualIngredientLines, ""])
                }
              >
                + Add ingredient
              </button>
            </div>
          )}
          {manualAddRecipeTab === "cooktime" && (
            <div className="manual-recipe-cooktime">
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-time"
              >
                Cook time (minutes){" "}
                <span className="add-recipe-manual-required">*</span>
              </label>
              <input
                id="create-recipe-time"
                type="number"
                min={1}
                className="add-recipe-manual-input"
                placeholder="e.g. 30"
                value={manualTimeInMinutes}
                onChange={(e) => {
                  setManualTimeInMinutes(e.target.value);
                  clearError();
                }}
                aria-required
              />
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-calories"
                style={{ marginTop: 12 }}
              >
                Calories (optional)
              </label>
              <input
                id="create-recipe-calories"
                type="number"
                min={0}
                className="add-recipe-manual-input"
                placeholder="e.g. 250"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value)}
              />
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-cuisine"
                style={{ marginTop: 12 }}
              >
                Cuisine type (optional)
              </label>
              <input
                id="create-recipe-cuisine"
                type="text"
                className="add-recipe-manual-input"
                placeholder="e.g. American"
                value={manualCuisineType}
                onChange={(e) => setManualCuisineType(e.target.value)}
              />
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-meal"
                style={{ marginTop: 12 }}
              >
                Meal type (optional)
              </label>
              <input
                id="create-recipe-meal"
                type="text"
                className="add-recipe-manual-input"
                placeholder="e.g. lunch"
                value={manualMealType}
                onChange={(e) => setManualMealType(e.target.value)}
              />
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-image"
                style={{ marginTop: 12 }}
              >
                Image URL (optional)
              </label>
              <input
                id="create-recipe-image"
                type="url"
                className="add-recipe-manual-input"
                placeholder="https://..."
                value={manualImageUrl}
                onChange={(e) => setManualImageUrl(e.target.value)}
              />
              <label
                className="add-recipe-manual-label"
                htmlFor="create-recipe-website"
                style={{ marginTop: 12 }}
              >
                Website URL (optional)
              </label>
              <input
                id="create-recipe-website"
                type="url"
                className="add-recipe-manual-input"
                placeholder="https://..."
                value={manualWebsiteUrl}
                onChange={(e) => setManualWebsiteUrl(e.target.value)}
              />
            </div>
          )}
          {manualAddRecipeTab === "steps" && (
            <div className="manual-recipe-steps">
              {manualStepsLines.map((step, i) => (
                <div key={i} className="manual-recipe-step-row">
                  <span className="manual-recipe-step-num">{i + 1}.</span>
                  <textarea
                    className="add-recipe-manual-input manual-recipe-step-input"
                    value={step}
                    onChange={(e) => {
                      const next = [...manualStepsLines];
                      next[i] = e.target.value;
                      setManualStepsLines(next);
                    }}
                    placeholder="Step"
                    rows={2}
                    aria-label={`Step ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="manual-recipe-remove-btn"
                    onClick={() => {
                      const next = manualStepsLines.filter(
                        (_, idx) => idx !== i
                      );
                      setManualStepsLines(
                        next.length === 0 ? [""] : next
                      );
                    }}
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="manual-recipe-add-btn"
                onClick={() =>
                  setManualStepsLines([...manualStepsLines, ""])
                }
              >
                + Add step
              </button>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="add-recipe-manual-submit"
          disabled={!getManualFormValid() || manualSubmitting}
        >
          {manualSubmitting ? "Saving..." : "Save recipe"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link href="/dashboard/home" style={{ color: "var(--gray-700)" }}>
          Back to Home
        </Link>
      </p>
    </section>
  );
}
