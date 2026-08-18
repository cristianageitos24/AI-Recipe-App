"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  addRecipeToFolder,
  getFolderPageData,
  getFolderRecipes,
  renameFolder,
} from "@/app/actions/folders";
import { getFavorites } from "@/app/actions/favorites";
import { CookbookPageRecipeCard } from "@/components/CookbookPageRecipeCard";
import { RecipeFullView } from "@/components/RecipeFullView";
import { fetchCookbooksData, invalidateCookbooksData } from "@/lib/cookbooks-cache";
import { invalidateFolderPageData, readFolderPageData } from "@/lib/folder-page-prefetch";
import { buildManualRecipePayload } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/mobile/cookbook-folder.css";
import "@/app/styling/mobile/recipe-cards.css";
import "@/app/styling/mobile/create-import.css";

const cookbookHeroCovers = [
  "/images/food pictures/Recipes by Taylor Kiser.jpg",
  "/images/food pictures/Delicious Food by Sam Moghadam.jpg",
  "/images/version1/food pictures/chad-montano--GFCYhoRe48-unsplash.jpg",
  "/images/version1/food pictures/anna-tukhfatullina-food-photographer-stylist-Mzy-OjtCI70-unsplash.jpg",
  "/images/food pictures/Delicious Recipes Rirri.jpg",
];

function getHeroCoverForFolder(folderName: string, customUrl?: string | null) {
  const trimmed = customUrl?.trim();
  if (trimmed) return trimmed;
  const index = [...folderName].reduce((sum, char) => sum + char.charCodeAt(0), 0) % cookbookHeroCovers.length;
  return cookbookHeroCovers[index];
}

function formatRecipeCount(count: number) {
  return `${count} ${count === 1 ? "Recipe" : "Recipes"}`;
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function formatCreatedDate(createdAt: string | null) {
  if (!createdAt) return "Created";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Created";
  return `Created ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function CookbookFolderSkeleton() {
  return (
    <div className="cookbook-folder-skeleton" aria-hidden="true">
      <div className="cookbook-folder-skeleton-breadcrumb">
        <span className="cookbook-folder-skeleton-line cookbook-folder-skeleton-breadcrumb-link" />
        <span className="cookbook-folder-skeleton-line cookbook-folder-skeleton-breadcrumb-name" />
      </div>
      <div className="cookbook-folder-hero cookbook-folder-hero-skeleton">
        <div className="cookbook-folder-hero-content">
          <span className="cookbook-folder-skeleton-cover" />
          <div className="cookbook-folder-skeleton-main">
            <span className="cookbook-folder-skeleton-line cookbook-folder-skeleton-title" />
            <div className="cookbook-folder-skeleton-stats">
              <span className="cookbook-folder-skeleton-pill" />
              <span className="cookbook-folder-skeleton-pill" />
              <span className="cookbook-folder-skeleton-pill" />
            </div>
          </div>
        </div>
      </div>
      <span className="cookbook-folder-skeleton-search" />
      <div className="cookbook-folder-skeleton-section-header">
        <span className="cookbook-folder-skeleton-line cookbook-folder-skeleton-section-title" />
        <span className="cookbook-folder-skeleton-add-button" />
      </div>
      <div className="cookbook-page-recipe-cards-container cookbook-folder-skeleton-cards">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="cookbook-folder-skeleton-card" />
        ))}
      </div>
    </div>
  );
}

export default function CookbookFolderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderName = decodeURIComponent((params.folderName as string) ?? "");
  const [copyFolderName, setCopyFolderName] = useState(folderName);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderCoverImageUrl, setFolderCoverImageUrl] = useState<string | null>(null);
  const [folderCreatedAt, setFolderCreatedAt] = useState<string | null>(null);
  const [folderUnavailable, setFolderUnavailable] = useState(false);
  const [folderRecipes, setFolderRecipes] = useState<RecipeRow[]>([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isRenameOptionOpen, setIsRenameOptionOpen] = useState(false);
  const [folderRename, setFolderRename] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [addRecipeTab, setAddRecipeTab] = useState<"your-recipes" | "manual">("your-recipes");
  const [addableRecipes, setAddableRecipes] = useState<RecipeRow[]>([]);
  const [manualRecipeLabel, setManualRecipeLabel] = useState("");
  const [manualAddRecipeTab, setManualAddRecipeTab] = useState<"ingredients" | "cooktime" | "steps">("ingredients");
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

  const refreshFolderRecipes = useCallback(() => {
    getFolderRecipes(folderName).then((res) => {
      if (res.data) setFolderRecipes(res.data);
    });
  }, [folderName]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFolderUnavailable(false);
    setFolderId(null);
    setFolderRecipes([]);
    (async () => {
      const [folderRes, favoritesRes] = await Promise.all([
        readFolderPageData(folderName) ?? getFolderPageData(folderName),
        getFavorites(),
      ]);
      if (cancelled) return;
      if (!folderRes.data) {
        setFolderUnavailable(true);
        setIsLoading(false);
        return;
      }
      setFolderId(folderRes.data.folder.id);
      setCopyFolderName(folderRes.data.folder.folder_name);
      setFolderCoverImageUrl(folderRes.data.folder.cover_image_url);
      setFolderCreatedAt(folderRes.data.folder.created_at);
      setFolderRecipes(folderRes.data.recipes);
      if (favoritesRes.data) setFavorites(favoritesRes.data);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [folderName]);

  const favoriteIds = new Set(favorites.map((r) => r.recipe_id));
  const heroCoverUrl = getHeroCoverForFolder(copyFolderName, folderCoverImageUrl);
  const createdDateLabel = formatCreatedDate(folderCreatedAt);
  const totalCookTime = folderRecipes.reduce((sum, recipe) => sum + Math.max(0, recipe.time_in_minutes || 0), 0);
  const normalizedRecipeSearchQuery = recipeSearchQuery.trim().toLowerCase();
  const visibleFolderRecipes = normalizedRecipeSearchQuery
    ? folderRecipes.filter((recipe) =>
        [
          recipe.recipe_label,
          recipe.cuisine_type,
          recipe.meal_type,
          recipe.ingredient_lines,
        ].some((value) => (value ?? "").toLowerCase().includes(normalizedRecipeSearchQuery))
      )
    : folderRecipes;

  const handleFavoriteChange = useCallback((recipe: RecipeRow, isFavorited: boolean) => {
    if (isFavorited) {
      setFavorites((prev) => (prev.some((r) => r.recipe_id === recipe.recipe_id) ? prev : [...prev, recipe]));
    } else {
      setFavorites((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }, []);

  const openRecipeId = searchParams.get("openRecipeId");
  useEffect(() => {
    if (!openRecipeId || folderRecipes.length === 0) return;
    const match = folderRecipes.find((r) => r.id === openRecipeId);
    if (match) {
      setSelectedRecipeId(openRecipeId);
      router.replace(`/dashboard/cookbook/${encodeURIComponent(folderName)}`, { scroll: false });
    }
  }, [openRecipeId, folderRecipes, folderName, router]);

  useEffect(() => {
    if (!isAddRecipeModalOpen) return;
    const run = async () => {
      const [foldersRes, favoritesRes] = await Promise.all([fetchCookbooksData(), getFavorites()]);
      const folderList = foldersRes.data?.folders ?? [];
      const results = (foldersRes.data?.results ?? {}) as Record<string, RecipeRow[]>;
      const inFolder = new Set(folderRecipes.map((r) => r.recipe_id));
      const seen = new Set<string>();
      const list: RecipeRow[] = [];
      for (const folder of folderList) {
        for (const r of results[folder] ?? []) {
          if (!seen.has(r.recipe_id) && !inFolder.has(r.recipe_id)) {
            seen.add(r.recipe_id);
            list.push(r);
          }
        }
      }
      for (const r of favoritesRes.data ?? []) {
        if (!seen.has(r.recipe_id) && !inFolder.has(r.recipe_id)) {
          seen.add(r.recipe_id);
          list.push(r);
        }
      }
      setAddableRecipes(list);
    };
    run();
  }, [isAddRecipeModalOpen, folderName, folderRecipes]);

  function openRenameDialog() {
    setFolderRename(copyFolderName);
    setIsRenameOptionOpen(true);
  }

  function handleCancel() {
    setIsRenameOptionOpen(false);
  }

  async function handleConfirmFolderRename() {
    if (!folderId) return;
    const trimmed = folderRename.trim();
    if (!trimmed) return;
    const res = await renameFolder(folderId, trimmed);
    if (!res.error) {
      setIsRenameOptionOpen(false);
      invalidateCookbooksData();
      invalidateFolderPageData(copyFolderName);
      invalidateFolderPageData(trimmed);
      setCopyFolderName(trimmed);
      router.replace(`/dashboard/cookbook/${encodeURIComponent(trimmed)}`);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleConfirmFolderRename();
  }

  function closeAddRecipeModal() {
    setIsAddRecipeModalOpen(false);
    setAddRecipeTab("your-recipes");
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

  async function handleAddRecipeFromList(recipe: RecipeRow) {
    const res = await addRecipeToFolder(copyFolderName, recipe.recipe_id);
    if (!res.error) {
      invalidateCookbooksData();
      invalidateFolderPageData(copyFolderName);
      refreshFolderRecipes();
      setAddableRecipes((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }

  function getManualFormValid(): boolean {
    const label = manualRecipeLabel.trim();
    const ingredients = manualIngredientLines.map((s) => s.trim()).filter(Boolean);
    const time = Number(manualTimeInMinutes);
    return label.length > 0 && ingredients.length > 0 && Number.isFinite(time) && time > 0;
  }

  async function handleSubmitManualRecipe(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    if (!getManualFormValid()) {
      setManualError("Recipe name, at least one ingredient, and a positive cook time are required.");
      return;
    }
    setManualSubmitting(true);
    try {
      const ingredientsText = manualIngredientLines.map((s) => s.trim()).filter(Boolean).join("\n");
      const stepsText = manualStepsLines.map((s) => s.trim()).filter(Boolean).join("\n") || undefined;
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
      const res = await addRecipeToFolder(copyFolderName, payload);
      if (res.error) {
        setManualError(res.error);
        return;
      }
      invalidateCookbooksData();
      invalidateFolderPageData(copyFolderName);
      refreshFolderRecipes();
      closeAddRecipeModal();
    } finally {
      setManualSubmitting(false);
    }
  }

  if (!isLoading && folderUnavailable) {
    return (
      <div className="main-panel">
        <p>This cookbook isn&apos;t available.</p>
        <Link href="/dashboard/cookbook">Back to Cookbooks</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="main-panel">
        <CookbookFolderSkeleton />
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="cookbook-folder-shell">
        <nav className="cookbook-folder-breadcrumb" aria-label="Cookbook breadcrumb">
          <button type="button" onClick={() => router.push("/dashboard/cookbook")}>
            Cookbooks
          </button>
          <span aria-hidden>›</span>
          <strong>{copyFolderName}</strong>
        </nav>
        <section
          className="cookbook-folder-hero"
          style={{ backgroundImage: `url(${JSON.stringify(heroCoverUrl)})` }}
        >
          <div className="cookbook-folder-hero-overlay" />
          <div className="cookbook-folder-hero-content">
            <div
              className="cookbook-folder-hero-cover"
              style={{ backgroundImage: `url(${JSON.stringify(heroCoverUrl)})` }}
              aria-hidden="true"
            />
            <div className="cookbook-folder-hero-main">
              <div className="cookbook-folder-title-row">
                <h1>{copyFolderName}</h1>
                <button
                  type="button"
                  className="cookbook-folder-edit-title-btn"
                  onClick={openRenameDialog}
                  aria-label="Rename cookbook"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>
              <div className="cookbook-folder-stats" aria-label="Cookbook summary">
                <div className="cookbook-folder-stat">
                  <span className="cookbook-folder-stat-icon cookbook-folder-stat-icon-red" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </span>
                  <span>{formatRecipeCount(folderRecipes.length)}</span>
                </div>
                <div className="cookbook-folder-stat">
                  <span className="cookbook-folder-stat-icon cookbook-folder-stat-icon-green" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  </span>
                  <span>{formatMinutes(totalCookTime)} total</span>
                </div>
                <div className="cookbook-folder-stat">
                  <span className="cookbook-folder-stat-icon cookbook-folder-stat-icon-yellow" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <span>{createdDateLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="cookbook-folder-toolbar">
          <label className="cookbook-folder-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search recipes in this cookbook..."
              value={recipeSearchQuery}
              onChange={(e) => setRecipeSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="cookbook-folder-recipes-header">
          <h2>All Recipes ({visibleFolderRecipes.length})</h2>
          <button
            type="button"
            className="add-recipe-to-folder-btn"
            onClick={() => setIsAddRecipeModalOpen(true)}
          >
            + Add recipe
          </button>
        </div>
      </div>
      {folderRecipes.length === 0 ? (
        <div className="empty-folder-container">
          <img className="empty-folder-pic" src="/images/emptycookbook.svg" alt="Empty folder" />
          <p className="empty-folder-subtxt">It looks like you haven&apos;t saved a recipe to your folder yet</p>
        </div>
      ) : visibleFolderRecipes.length === 0 ? (
        <p className="cookbook-folder-no-results">No recipes match your search.</p>
      ) : (
        <div className="cookbook-page-recipe-cards-container">
          {visibleFolderRecipes.map((recipe) => (
            <CookbookPageRecipeCard
              key={recipe.id}
              recipeData={recipe}
              onSelectRecipe={(r) => setSelectedRecipeId(r.id)}
              isHearted={favoriteIds.has(recipe.recipe_id)}
              onFavoriteChange={handleFavoriteChange}
            />
          ))}
        </div>
      )}
      {selectedRecipeId && (() => {
        const recipe = folderRecipes.find((r) => r.id === selectedRecipeId);
        return recipe ? (
          <div
            className="recipe-full-view-overlay"
            onClick={() => setSelectedRecipeId(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedRecipeId(null)}
            role="button"
            tabIndex={0}
          >
            <div className="recipe-full-view-scroll-wrapper" onClick={(e) => e.stopPropagation()}>
              <RecipeFullView
                recipeData={recipe}
                onClose={() => setSelectedRecipeId(null)}
                isHearted={favoriteIds.has(recipe.recipe_id)}
                onFavoriteChange={handleFavoriteChange}
              />
            </div>
          </div>
        ) : null;
      })()}
      {isRenameOptionOpen && (
        <div className="rename-popup-overlay" onClick={handleCancel} onKeyDown={handleKeyPress}>
          <div className="rename-folder-popup" onClick={(e) => e.stopPropagation()}>
            <h1 className="rename-popup-title">Rename</h1>
            <input
              type="text"
              placeholder="Enter new folder name"
              value={folderRename}
              onChange={(e) => setFolderRename(e.target.value)}
              className="rename-input"
              autoFocus
            />
            <div className="rename-popup-bttns">
              <button type="button" className="cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" className="confirm" onClick={handleConfirmFolderRename}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddRecipeModalOpen && (
        <div
          className="rename-popup-overlay add-recipe-modal-overlay"
          onClick={closeAddRecipeModal}
          onKeyDown={(e) => e.key === "Escape" && closeAddRecipeModal()}
          role="button"
          tabIndex={0}
        >
          <div className="add-recipe-modal" onClick={(e) => e.stopPropagation()}>
            <h1 className="rename-popup-title">Add recipe to cookbook</h1>
            <div className="add-recipe-tabs">
              <button
                type="button"
                className={`add-recipe-tab ${addRecipeTab === "your-recipes" ? "active" : ""}`}
                onClick={() => setAddRecipeTab("your-recipes")}
              >
                Your recipes
              </button>
              <button
                type="button"
                className={`add-recipe-tab ${addRecipeTab === "manual" ? "active" : ""}`}
                onClick={() => setAddRecipeTab("manual")}
              >
                Add manually
              </button>
            </div>
            {addRecipeTab === "your-recipes" ? (
              <div className="add-recipe-list-container">
                {addableRecipes.length === 0 ? (
                  <p className="add-recipe-empty-msg">
                    Like or save recipes from Home first, or use the Add manually tab.
                  </p>
                ) : (
                  <ul className="add-recipe-list">
                    {addableRecipes.map((recipe) => (
                      <li key={recipe.id}>
                        <button
                          type="button"
                          className="add-recipe-list-item"
                          onClick={() => handleAddRecipeFromList(recipe)}
                        >
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt=""
                              className="add-recipe-list-item-img"
                            />
                          ) : (
                            <img src="/images/recipe-placeholder.png" alt="" className="add-recipe-list-item-img add-recipe-list-item-img-placeholder" aria-hidden />
                          )}
                          <span className="add-recipe-list-item-label">{recipe.recipe_label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="add-recipe-search-container">
                  <form className="add-recipe-manual-form manual-recipe-tabbed-form" onSubmit={handleSubmitManualRecipe}>
                    {manualError && <p className="add-recipe-manual-error">{manualError}</p>}
                    <label className="add-recipe-manual-label">
                      Recipe name <span className="add-recipe-manual-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="add-recipe-manual-input manual-recipe-title-input"
                      placeholder="e.g. Chocolate Cake"
                      value={manualRecipeLabel}
                      onChange={(e) => setManualRecipeLabel(e.target.value)}
                    />
                    <div className="manual-recipe-tabs">
                      <button
                        type="button"
                        className={`manual-recipe-tab ${manualAddRecipeTab === "ingredients" ? "active" : ""}`}
                        onClick={() => setManualAddRecipeTab("ingredients")}
                      >
                        Ingredients
                      </button>
                      <button
                        type="button"
                        className={`manual-recipe-tab ${manualAddRecipeTab === "cooktime" ? "active" : ""}`}
                        onClick={() => setManualAddRecipeTab("cooktime")}
                      >
                        Cook time
                      </button>
                      <button
                        type="button"
                        className={`manual-recipe-tab ${manualAddRecipeTab === "steps" ? "active" : ""}`}
                        onClick={() => setManualAddRecipeTab("steps")}
                      >
                        Steps
                      </button>
                    </div>
                    <div className="manual-recipe-tab-panel">
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
                                }}
                                placeholder="Ingredient"
                              />
                              <button
                                type="button"
                                className="manual-recipe-remove-btn"
                                onClick={() => {
                                  const next = manualIngredientLines.filter((_, idx) => idx !== i);
                                  setManualIngredientLines(next.length === 0 ? [""] : next);
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
                            onClick={() => setManualIngredientLines([...manualIngredientLines, ""])}
                          >
                            + Add ingredient
                          </button>
                        </div>
                      )}
                      {manualAddRecipeTab === "cooktime" && (
                        <div className="manual-recipe-cooktime">
                          <label className="add-recipe-manual-label">
                            Cook time (minutes) <span className="add-recipe-manual-required">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            className="add-recipe-manual-input"
                            placeholder="e.g. 30"
                            value={manualTimeInMinutes}
                            onChange={(e) => setManualTimeInMinutes(e.target.value)}
                          />
                          <label className="add-recipe-manual-label" style={{ marginTop: 12 }}>Calories (optional)</label>
                          <input
                            type="number"
                            min={0}
                            className="add-recipe-manual-input"
                            placeholder="e.g. 250"
                            value={manualCalories}
                            onChange={(e) => setManualCalories(e.target.value)}
                          />
                          <label className="add-recipe-manual-label" style={{ marginTop: 12 }}>Cuisine type (optional)</label>
                          <input
                            type="text"
                            className="add-recipe-manual-input"
                            placeholder="e.g. American"
                            value={manualCuisineType}
                            onChange={(e) => setManualCuisineType(e.target.value)}
                          />
                          <label className="add-recipe-manual-label" style={{ marginTop: 12 }}>Meal type (optional)</label>
                          <input
                            type="text"
                            className="add-recipe-manual-input"
                            placeholder="e.g. lunch"
                            value={manualMealType}
                            onChange={(e) => setManualMealType(e.target.value)}
                          />
                          <label className="add-recipe-manual-label" style={{ marginTop: 12 }}>Image URL (optional)</label>
                          <input
                            type="url"
                            className="add-recipe-manual-input"
                            placeholder="https://..."
                            value={manualImageUrl}
                            onChange={(e) => setManualImageUrl(e.target.value)}
                          />
                          <label className="add-recipe-manual-label" style={{ marginTop: 12 }}>Website URL (optional)</label>
                          <input
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
                              />
                              <button
                                type="button"
                                className="manual-recipe-remove-btn"
                                onClick={() => {
                                  const next = manualStepsLines.filter((_, idx) => idx !== i);
                                  setManualStepsLines(next.length === 0 ? [""] : next);
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
                            onClick={() => setManualStepsLines([...manualStepsLines, ""])}
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
                      {manualSubmitting ? "Adding..." : "Add recipe"}
                    </button>
                  </form>
              </div>
            )}
            <div className="rename-popup-bttns" style={{ marginTop: 16 }}>
              <button type="button" className="cancel" onClick={closeAddRecipeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
