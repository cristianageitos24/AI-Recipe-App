"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRecipeAndReturn, uploadManualRecipeImage } from "@/app/actions/recipes";
import { RecipeFullView } from "@/components/RecipeFullView";
import { buildManualRecipePayload } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/CookbookPageRecipeCard.css";

const MAX_MANUAL_IMAGE_BYTES = 8 * 1024 * 1024;

const CREATE_RECIPE_DETAILS_FIELD_IDS = [
  "create-recipe-time",
  "create-recipe-calories",
  "create-recipe-cuisine",
  "create-recipe-meal",
  "create-recipe-website",
] as const;

function focusNextCreateRecipeDetailsField(currentId: string) {
  const idx = CREATE_RECIPE_DETAILS_FIELD_IDS.indexOf(
    currentId as (typeof CREATE_RECIPE_DETAILS_FIELD_IDS)[number]
  );
  if (idx < 0 || idx >= CREATE_RECIPE_DETAILS_FIELD_IDS.length - 1) return;
  document.getElementById(CREATE_RECIPE_DETAILS_FIELD_IDS[idx + 1])?.focus();
}

function focusAfterPaint(selector: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      (document.querySelector(selector) as HTMLElement | null)?.focus();
    });
  });
}

export default function CreateRecipePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [createdRecipe, setCreatedRecipe] = useState<RecipeRow | null>(null);

  const [manualRecipeLabel, setManualRecipeLabel] = useState("");
  const [manualAddRecipeTab, setManualAddRecipeTab] = useState<
    "ingredients" | "steps" | "details"
  >("ingredients");
  const [manualIngredientLines, setManualIngredientLines] = useState<string[]>([""]);
  const [manualStepsLines, setManualStepsLines] = useState<string[]>([""]);
  const [manualTimeInMinutes, setManualTimeInMinutes] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualCuisineType, setManualCuisineType] = useState("");
  const [manualMealType, setManualMealType] = useState("");
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreviewUrl, setManualImagePreviewUrl] = useState("");
  const [manualWebsiteUrl, setManualWebsiteUrl] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!manualImageFile) {
      setManualImagePreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(manualImageFile);
    setManualImagePreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [manualImageFile]);

  const previewRecipe = useMemo<RecipeRow>(() => {
    const ingredient_lines = manualIngredientLines
      .map((s) => s.trim())
      .filter(Boolean)
      .join("***");
    const steps = manualStepsLines
      .map((s) => s.trim())
      .filter(Boolean)
      .join("***");
    const time = Number(manualTimeInMinutes);
    const calories = Number(manualCalories);
    return {
      id: "create-recipe-preview",
      recipe_id: "create-recipe-preview",
      recipe_label: manualRecipeLabel.trim() || "Untitled Recipe",
      calories: Number.isFinite(calories) && calories >= 0 ? calories : 0,
      cuisine_type: manualCuisineType.trim() || null,
      meal_type: manualMealType.trim() || null,
      time_in_minutes: Number.isFinite(time) && time >= 0 ? time : 0,
      ingredient_lines: ingredient_lines || null,
      steps: steps || null,
      website_url: manualWebsiteUrl.trim() || null,
      image_url: manualImagePreviewUrl || null,
    };
  }, [
    manualCalories,
    manualCuisineType,
    manualImagePreviewUrl,
    manualIngredientLines,
    manualMealType,
    manualRecipeLabel,
    manualStepsLines,
    manualTimeInMinutes,
    manualWebsiteUrl,
  ]);

  function clearError() {
    setManualError("");
  }

  function triggerManualImagePicker() {
    fileInputRef.current?.click();
  }

  function handleDetailsFieldEnter(
    e: React.KeyboardEvent<HTMLInputElement>,
    fieldId: string
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    focusNextCreateRecipeDetailsField(fieldId);
  }

  function handleManualImageSelection(file?: File) {
    if (!file) {
      setManualImageFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setManualError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_MANUAL_IMAGE_BYTES) {
      setManualError("Image must be 8MB or smaller.");
      return;
    }
    setManualImageFile(file);
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
    setManualImageFile(null);
    setManualImagePreviewUrl("");
    setManualWebsiteUrl("");
    setManualError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      let uploadedImageUrl: string | undefined;
      if (manualImageFile) {
        const imageFormData = new FormData();
        imageFormData.append("image", manualImageFile);
        imageFormData.append("recipeLabel", manualRecipeLabel);
        const uploadRes = await uploadManualRecipeImage(imageFormData);
        if (uploadRes.error || !uploadRes.url) {
          setManualError(uploadRes.error ?? "Failed to upload recipe image.");
          return;
        }
        uploadedImageUrl = uploadRes.url;
      }

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
        imageUrl: uploadedImageUrl,
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
          <RecipeFullView recipeData={createdRecipe} onClose={() => router.push("/dashboard/home")} />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={resetToForm}
              className="add-recipe-manual-submit"
              style={{ background: "var(--gray-600)" }}
            >
              Create another recipe
            </button>
          </div>
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
      <div className="recipe-full-view-scroll-wrapper" style={{ marginBottom: 20 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="create-recipe-image-input"
          onChange={(e) => handleManualImageSelection(e.target.files?.[0])}
        />
        <RecipeFullView
          recipeData={previewRecipe}
          hideFavoriteAction
          draftTitle={{
            value: manualRecipeLabel,
            onChange: (v) => {
              setManualRecipeLabel(v);
              clearError();
            },
            placeholder: "Recipe Name",
          }}
          heroOverlay={
            <button
              type="button"
              className="create-recipe-image-hitarea"
              onClick={triggerManualImagePicker}
              disabled={manualSubmitting}
            >
              <span className="create-recipe-image-hitarea-label">
                {manualImageFile ? "Click to change photo" : "Click anywhere to upload recipe photo"}
              </span>
            </button>
          }
          primaryActionSlot={
            <button
              type="button"
              className="submit-button video-recipe-save-btn"
              style={{ margin: 0 }}
              onClick={() => {
                const form = document.getElementById("create-recipe-form");
                form?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Fill recipe data
            </button>
          }
        />
      </div>
      <form
        id="create-recipe-form"
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
          placeholder="Recipe Name"
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
            aria-selected={manualAddRecipeTab === "steps"}
            className={`manual-recipe-tab ${manualAddRecipeTab === "steps" ? "active" : ""}`}
            onClick={() => setManualAddRecipeTab("steps")}
          >
            Steps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manualAddRecipeTab === "details"}
            className={`manual-recipe-tab ${manualAddRecipeTab === "details" ? "active" : ""}`}
            onClick={() => setManualAddRecipeTab("details")}
          >
            Details
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
                    data-create-recipe-ingredient={i}
                    value={line}
                    onChange={(e) => {
                      const next = [...manualIngredientLines];
                      next[i] = e.target.value;
                      setManualIngredientLines(next);
                      clearError();
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const newIndex = manualIngredientLines.length;
                      setManualIngredientLines((lines) => [...lines, ""]);
                      focusAfterPaint(
                        `[data-create-recipe-ingredient="${newIndex}"]`
                      );
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
          {manualAddRecipeTab === "steps" && (
            <div className="manual-recipe-steps">
              {manualStepsLines.map((step, i) => (
                <div key={i} className="manual-recipe-step-row">
                  <span className="manual-recipe-step-num">{i + 1}.</span>
                  <textarea
                    className="add-recipe-manual-input manual-recipe-step-input"
                    data-create-recipe-step={i}
                    value={step}
                    onChange={(e) => {
                      const next = [...manualStepsLines];
                      next[i] = e.target.value;
                      setManualStepsLines(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return;
                      e.preventDefault();
                      const newIndex = manualStepsLines.length;
                      setManualStepsLines((lines) => [...lines, ""]);
                      focusAfterPaint(`[data-create-recipe-step="${newIndex}"]`);
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
          {manualAddRecipeTab === "details" && (
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
                onKeyDown={(e) => handleDetailsFieldEnter(e, "create-recipe-time")}
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
                onKeyDown={(e) => handleDetailsFieldEnter(e, "create-recipe-calories")}
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
                onKeyDown={(e) => handleDetailsFieldEnter(e, "create-recipe-cuisine")}
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
                onKeyDown={(e) => handleDetailsFieldEnter(e, "create-recipe-meal")}
              />
              <div style={{ marginTop: 12 }}>
                <p className="add-recipe-manual-label" style={{ marginBottom: 8 }}>
                  Recipe photo (optional)
                </p>
                <div className="create-recipe-image-controls">
                  <button
                    type="button"
                    className="manual-recipe-add-btn"
                    onClick={triggerManualImagePicker}
                    disabled={manualSubmitting}
                  >
                    {manualImageFile ? "Change selected image" : "Choose image"}
                  </button>
                  {manualImageFile && (
                    <button
                      type="button"
                      className="manual-recipe-remove-btn"
                      onClick={() => {
                        setManualImageFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Remove selected image"
                      disabled={manualSubmitting}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="create-recipe-image-hint">
                  {manualImageFile
                    ? `${manualImageFile.name} (${Math.max(1, Math.round(manualImageFile.size / 1024))} KB)`
                    : "No image selected"}
                </p>
              </div>
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
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                }}
              />
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
