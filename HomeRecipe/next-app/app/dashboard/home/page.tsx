"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RecipeListCard } from "@/components/RecipeListCard";
import { getHomeBootstrap } from "@/app/actions/dashboard";
import {
  getSearchSuggestions,
  getIngredientSuggestions,
  searchRecipes,
  searchByIngredients,
} from "@/app/actions/search";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabHome.css";
import "@/app/styling/VideoUpload.css";

type FolderWithCount = { folderName: string; count: number };
type SearchMode = "recipe" | "ingredients";
type MealDay = { date: string; recipes: Array<RecipeRow & { eventID: string }> };
type ImportedRecipePreview = {
  source_url: string;
  title: string | null;
  image: string | null;
  ingredients: string[];
  instructions: string | null;
  instructions_list: string[];
  total_time_minutes: number | null;
  calories: string | null;
  yields: string | null;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(year, month - 1, day, 12);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(dt);
}

export default function DashboardHomePage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("recipe");
  const [text, setText] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [displayQuery, setDisplayQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoImportLoading, setVideoImportLoading] = useState(false);
  const [videoImportError, setVideoImportError] = useState<string | null>(null);
  const [videoImportSuccess, setVideoImportSuccess] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlImportLoading, setUrlImportLoading] = useState(false);
  const [urlImportError, setUrlImportError] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<ImportedRecipePreview | null>(null);
  const [showUrlPreviewModal, setShowUrlPreviewModal] = useState(false);
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [mealDates, setMealDates] = useState<MealDay[]>([]);
  const [folderRecipesByName, setFolderRecipesByName] = useState<Record<string, RecipeRow[]>>({});
  const [foldersWithCounts, setFoldersWithCounts] = useState<FolderWithCount[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeRow[]>([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    ingredients: string[];
    recipes: { recipe_id: string; recipe_label: string }[];
  }>({ ingredients: [], recipes: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRequestIdRef = useRef(0);
  const liveSearchRequestIdRef = useRef(0);
  const searchInProgressRef = useRef(false);
  const [searchSlowMessage, setSearchSlowMessage] = useState(false);
  const [recommendationsScroll, setRecommendationsScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);

  const favoriteIds = useMemo(() => new Set(favorites.map((r) => r.recipe_id)), [favorites]);

  const homeStats = useMemo(() => {
    const savedMap = new Map<string, RecipeRow>();
    const engagement = new Map<string, { recipe: RecipeRow; score: number }>();

    const bump = (recipe: RecipeRow, amount: number) => {
      const prev = engagement.get(recipe.recipe_id);
      if (prev) {
        prev.score += amount;
      } else {
        engagement.set(recipe.recipe_id, { recipe, score: amount });
      }
    };

    for (const recipe of favorites) {
      savedMap.set(recipe.recipe_id, recipe);
      bump(recipe, 2);
    }

    for (const recipes of Object.values(folderRecipesByName)) {
      for (const recipe of recipes) {
        if (!savedMap.has(recipe.recipe_id)) savedMap.set(recipe.recipe_id, recipe);
        bump(recipe, 1);
      }
    }

    for (const day of mealDates) {
      for (const recipe of day.recipes) {
        bump(recipe, 1);
      }
    }

    const cuisineCounts = new Map<string, number>();
    for (const recipe of savedMap.values()) {
      const cuisine = recipe.cuisine_type?.trim();
      if (!cuisine) continue;
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
    }

    const mostCommonCuisine =
      [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

    const topViewed = [...engagement.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.recipe);

    return {
      totalRecipesSaved: savedMap.size,
      favoritesCount: favorites.length,
      mostCommonCuisine,
      topViewed,
    };
  }, [favorites, folderRecipesByName, mealDates]);

  const upcomingMealPlans = useMemo(() => {
    if (mealDates.length === 0) return [];
    const today = getLocalDateKey();
    const sorted = [...mealDates].sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = sorted.filter((entry) => entry.date >= today);
    const base = (upcoming.length > 0 ? upcoming : sorted).slice(0, 2);
    return base.map((plan) => ({
      ...plan,
      label: plan.date === today ? "Today" : formatDateKey(plan.date),
      isToday: plan.date === today,
    }));
  }, [mealDates]);

  const handleFavoriteChange = useCallback((recipe: RecipeRow, isFavorited: boolean) => {
    if (isFavorited) {
      setFavorites((prev) =>
        prev.some((r) => r.recipe_id === recipe.recipe_id) ? prev : [...prev, recipe]
      );
    } else {
      setFavorites((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }, []);

  const debouncedTextForSuggestions = useDebounce(text, 150);
  const debouncedTextForSearch = useDebounce(text, 400);

  const updateRecommendationsScrollState = useCallback(() => {
    const el = recommendationsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
    setRecommendationsScroll((prev) =>
      prev.canScrollLeft !== canScrollLeft || prev.canScrollRight !== canScrollRight
        ? { canScrollLeft, canScrollRight }
        : prev
    );
  }, []);

  const scrollRecommendations = useCallback((direction: "left" | "right") => {
    const el = recommendationsScrollRef.current;
    if (!el) return;
    const firstChild = el.querySelector(".home-recommendation-card") as HTMLElement | null;
    const gap = 12;
    const cardWidth = firstChild ? firstChild.offsetWidth + gap : 280;
    const scrollAmount = cardWidth * 2;
    el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
  }, []);

  useEffect(() => {
    updateRecommendationsScrollState();
    const el = recommendationsScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateRecommendationsScrollState);
    const ro = new ResizeObserver(updateRecommendationsScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateRecommendationsScrollState);
      ro.disconnect();
    };
  }, [suggestedRecipes.length, updateRecommendationsScrollState]);

  useEffect(() => {
    setSuggestedLoading(true);
    getHomeBootstrap()
      .then((res) => {
        if (!res.data) return;
        setFavorites(res.data.favorites);
        setFoldersWithCounts(
          res.data.folders.map((name) => ({
            folderName: name,
            count: (res.data.results[name] ?? []).length,
          }))
        );
        setFolderRecipesByName((res.data.results ?? {}) as Record<string, RecipeRow[]>);
        setMealDates((res.data.mealDates ?? []) as MealDay[]);
        setSuggestedRecipes(res.data.suggestedRecipes);
      })
      .catch(() => setSuggestedRecipes([]))
      .finally(() => {
        setSuggestedLoading(false);
        setBootstrapLoading(false);
      });
  }, []);

  useEffect(() => {
    if (searchInProgressRef.current) return;
    const trimmed = debouncedTextForSuggestions.trim();
    const isIngredientMode = searchMode === "ingredients";
    const minLength = isIngredientMode ? 1 : 2;
    if (trimmed.length < minLength) {
      setSuggestions({ ingredients: [], recipes: [] });
      return;
    }
    if (inputRef.current && document.activeElement !== inputRef.current) {
      return;
    }
    const requestId = ++suggestionRequestIdRef.current;
    if (isIngredientMode) {
      getIngredientSuggestions(trimmed).then((res) => {
        if (requestId !== suggestionRequestIdRef.current) return;
        if (res.data) setSuggestions({ ingredients: res.data, recipes: [] });
      });
    } else {
      getSearchSuggestions(trimmed).then((res) => {
        if (requestId !== suggestionRequestIdRef.current) return;
        if (res.data) setSuggestions(res.data);
      });
    }
  }, [debouncedTextForSuggestions, searchMode]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      suggestionsRef.current &&
      !suggestionsRef.current.contains(e.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(e.target as Node)
    ) {
      setShowSuggestions(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    const blurSearchInput = () => inputRef.current?.blur();
    // Prevent persisted focus when navigating back/refreshing.
    requestAnimationFrame(blurSearchInput);
    window.addEventListener("focus", blurSearchInput);
    document.addEventListener("visibilitychange", blurSearchInput);
    return () => {
      window.removeEventListener("focus", blurSearchInput);
      document.removeEventListener("visibilitychange", blurSearchInput);
    };
  }, []);

  useEffect(() => {
    const trimmed = debouncedTextForSearch.trim();
    const isIngredientMode = searchMode === "ingredients";
    const ings =
      selectedIngredients.length > 0
        ? selectedIngredients
        : trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    if (isIngredientMode) {
      if (ings.length === 0) {
        setSearchResults(null);
        setDisplayQuery("");
        setSearchError(null);
        return;
      }
    } else if (trimmed.length < 2) {
      setSearchResults(null);
      setDisplayQuery("");
      setSearchError(null);
      return;
    }

    setSearchError(null);
    setSearchSlowMessage(false);
    setSearchLoading(true);
    const requestId = ++liveSearchRequestIdRef.current;

    if (isIngredientMode) {
      setDisplayQuery(ings.join(", "));
      searchByIngredients(ings)
        .then((res) => {
          if (requestId !== liveSearchRequestIdRef.current) return;
          setSearchResults(res.data ?? []);
          if (res.error) setSearchError(res.error);
        })
        .catch(() => {
          if (requestId !== liveSearchRequestIdRef.current) return;
          setSearchResults([]);
          setSearchError("Search failed. Try again.");
        })
        .finally(() => {
          if (requestId === liveSearchRequestIdRef.current) {
            setSearchLoading(false);
            setSearchSlowMessage(false);
          }
        });
    } else {
      setDisplayQuery(trimmed);
      searchRecipes(trimmed)
        .then((res) => {
          if (requestId !== liveSearchRequestIdRef.current) return;
          setSearchResults(res.data ?? []);
          if (res.error) setSearchError(res.error);
        })
        .catch(() => {
          if (requestId !== liveSearchRequestIdRef.current) return;
          setSearchResults([]);
          setSearchError("Search failed. Try again.");
        })
        .finally(() => {
          if (requestId === liveSearchRequestIdRef.current) {
            setSearchLoading(false);
            setSearchSlowMessage(false);
          }
        });
    }
  }, [debouncedTextForSearch, searchMode, selectedIngredients]);

  async function handleSearch() {
    if (searchLoading) return;
    setShowSuggestions(false);
    setSearchError(null);
    setSearchSlowMessage(false);
    searchInProgressRef.current = true;

    if (searchMode === "recipe") {
      const query = text.trim();
      if (!query) {
        searchInProgressRef.current = false;
        return;
      }
      setSearchLoading(true);
      setDisplayQuery(query);
      try {
        const res = await searchRecipes(query);
        setSearchResults(res.data ?? []);
      } catch {
        setSearchResults([]);
        setSearchError("Search failed. Try again.");
      } finally {
        setSearchLoading(false);
        setSearchSlowMessage(false);
        searchInProgressRef.current = false;
      }
    } else {
      const ings =
        selectedIngredients.length > 0
          ? selectedIngredients
          : text
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      if (ings.length === 0) {
        searchInProgressRef.current = false;
        return;
      }
      setSearchLoading(true);
      setDisplayQuery(ings.join(", "));
      try {
        const res = await searchByIngredients(ings);
        setSearchResults(res.data ?? []);
      } catch {
        setSearchResults([]);
        setSearchError("Search failed. Try again.");
      } finally {
        setSearchLoading(false);
        setSearchSlowMessage(false);
        searchInProgressRef.current = false;
      }
    }
  }

  useEffect(() => {
    if (!searchLoading) {
      setSearchSlowMessage(false);
      return;
    }
    const t = setTimeout(() => setSearchSlowMessage(true), 5000);
    return () => clearTimeout(t);
  }, [searchLoading]);

  useEffect(() => {
    if (!searchModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [searchModalOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function addIngredient(ing: string) {
    if (!selectedIngredients.includes(ing)) {
      setSelectedIngredients([...selectedIngredients, ing]);
    }
    setText("");
    setShowSuggestions(false);
  }

  function removeIngredient(ing: string) {
    setSelectedIngredients(selectedIngredients.filter((i) => i !== ing));
  }

  function closeSearchModalAndReset() {
    setSearchModalOpen(false);
    setShowSuggestions(false);
    setText("");
    setDisplayQuery("");
    setSearchResults(null);
    setSearchError(null);
    setSearchSlowMessage(false);
    searchInProgressRef.current = false;
    inputRef.current?.blur();
  }

  useEffect(() => {
    if (!searchModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearchModalAndReset();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [searchModalOpen]);

  async function handleUrlImportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!urlInput.trim() || urlImportLoading) return;
    setUrlImportLoading(true);
    setUrlImportError(null);
    try {
      const res = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = (await res.json()) as ImportedRecipePreview | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to import recipe URL");
      }
      setUrlPreview(data as ImportedRecipePreview);
      setShowUrlPreviewModal(true);
    } catch (err) {
      setUrlImportError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setUrlImportLoading(false);
    }
  }

  async function handleVideoImportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!videoUrlInput.trim() || videoImportLoading) return;
    setVideoImportLoading(true);
    setVideoImportError(null);
    setVideoImportSuccess(null);
    try {
      const res = await fetch("/api/video/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrlInput.trim() }),
      });
      const data = (await res.json()) as { error?: string; detail?: string; jobId?: string };
      if (!res.ok) {
        const message = data.detail ? `${data.error ?? "Error"}: ${data.detail}` : data.error ?? "Failed to start extraction";
        throw new Error(message);
      }
      setVideoImportSuccess("Extraction started. Continue in Video Upload tools.");
      setVideoUrlInput("");
    } catch (err) {
      setVideoImportError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setVideoImportLoading(false);
    }
  }

  const hasSuggestions = suggestions.ingredients.length > 0 || suggestions.recipes.length > 0;
  const hasSearchInputText = text.trim().length > 0;
  const cardHoverMotion = { y: -4 };
  const cardHoverTransition = { duration: 0.18, ease: "easeOut" as const };

  return (
    <div className="main-panel">
      {bootstrapLoading ? (
        <LoadingScreen />
      ) : (
        <motion.div
          className="recipe-search-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <section className="home-dashboard-header">
            <div className="home-search-shell">
              <div className="search-mode-tabs">
                <button
                  type="button"
                  className={`search-mode-tab ${searchMode === "recipe" ? "active" : ""}`}
                  onClick={() => setSearchMode("recipe")}
                >
                  Recipe name
                </button>
                <button
                  type="button"
                  className={`search-mode-tab ${searchMode === "ingredients" ? "active" : ""}`}
                  onClick={() => setSearchMode("ingredients")}
                >
                  Ingredients
                </button>
              </div>

              <div className="search-container">
                {searchMode === "ingredients" && selectedIngredients.length > 0 && (
                  <div className="ingredient-chips">
                    {selectedIngredients.map((ing) => (
                      <span key={ing} className="ingredient-chip">
                        {ing}
                        <button
                          type="button"
                          className="ingredient-chip-remove"
                          onClick={() => removeIngredient(ing)}
                          aria-label={`Remove ${ing}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="search-input-dropdown-wrapper">
                  <div className="search-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={
                        searchMode === "recipe"
                          ? "Search your recipes..."
                          : "Search by ingredient to find recipes"
                      }
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => {
                        if (hasSuggestions) setShowSuggestions(true);
                        setSearchModalOpen(true);
                      }}
                      className="search-txt"
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      type="button"
                      className={`search-btn ${searchModalOpen ? "search-btn-close" : ""}`}
                      onClick={() => {
                        if (searchModalOpen) {
                          closeSearchModalAndReset();
                          return;
                        }
                        handleSearch();
                      }}
                      disabled={searchLoading}
                      aria-busy={searchLoading}
                      title={searchModalOpen ? "Close search" : "Search"}
                    >
                      {searchModalOpen ? (
                        <span aria-hidden>×</span>
                      ) : (
                        <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M17.71 16.29L14.31 12.9C15.407 11.5025 16.0022 9.77666 16 8C16 6.41775 15.5308 4.87103 14.6518 3.55544C13.7727 2.23985 12.5233 1.21447 11.0615 0.608967C9.59966 0.00346625 7.99113 -0.15496 6.43928 0.153721C4.88743 0.462403 3.46197 1.22433 2.34315 2.34315C1.22433 3.46197 0.462403 4.88743 0.153721 6.43928C-0.15496 7.99113 0.00346625 9.59966 0.608967 11.0615C1.21447 12.5233 2.23985 13.7727 3.55544 14.6518C4.87103 15.5308 6.41775 16 8 16C9.77666 16.0022 11.5025 15.407 12.9 14.31L16.29 17.71C16.383 17.8037 16.4936 17.8781 16.6154 17.9289C16.7373 17.9797 16.868 18.0058 17 18.0058C17.132 18.0058 17.2627 17.9797 17.3846 17.9289C17.5064 17.8781 17.617 17.8037 17.71 17.71C17.8037 17.617 17.8781 17.5064 17.9289 17.3846C17.9797 17.2627 18.0058 17.132 18.0058 17C18.0058 16.868 17.9797 16.7373 17.9289 16.6154C17.8781 16.4936 17.8037 16.383 17.71 16.29ZM2 8C2 6.81332 2.3519 5.65328 3.01119 4.66658C3.67047 3.67989 4.60755 2.91085 5.7039 2.45673C6.80026 2.0026 8.00666 1.88378 9.17055 2.11529C10.3344 2.3468 11.4035 2.91825 12.2426 3.75736C13.0818 4.59648 13.6532 5.66558 13.8847 6.82946C14.1162 7.99335 13.9974 9.19975 13.5433 10.2961C13.0892 11.3925 12.3201 12.3295 11.3334 12.9888C10.3467 13.6481 9.18669 14 8 14C6.4087 14 4.88258 13.3679 3.75736 12.2426C2.63214 11.1174 2 9.5913 2 8Z"
                            fill="black"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {showSuggestions && hasSuggestions && (
                    <div ref={suggestionsRef} className="autocomplete-dropdown">
                      {suggestions.ingredients.length > 0 && (
                        <div className="autocomplete-section">
                          <span className="autocomplete-label">Ingredients</span>
                          {suggestions.ingredients.map((ing) => (
                            <button
                              key={ing}
                              type="button"
                              className="autocomplete-item"
                              onClick={() => {
                                if (searchMode === "ingredients") {
                                  addIngredient(ing);
                                  return;
                                }
                                setText(ing);
                                setDisplayQuery(ing);
                                setShowSuggestions(false);
                                inputRef.current?.focus();
                              }}
                            >
                              {ing}
                            </button>
                          ))}
                        </div>
                      )}

                      {searchMode !== "ingredients" && suggestions.recipes.length > 0 && (
                        <div className="autocomplete-section">
                          <span className="autocomplete-label">Recipes</span>
                          {suggestions.recipes.map((r) => (
                            <button
                              key={r.recipe_id}
                              type="button"
                              className="autocomplete-item"
                              onClick={() => {
                                if (searchLoading) return;
                                setText(r.recipe_label);
                                setShowSuggestions(false);
                                setDisplayQuery(r.recipe_label);
                                setSearchError(null);
                                setSearchLoading(true);
                                searchInProgressRef.current = true;
                                searchRecipes(r.recipe_label)
                                  .then((res) => {
                                    setSearchResults(res.data ?? []);
                                  })
                                  .catch(() => {
                                    setSearchResults([]);
                                    setSearchError("Search failed. Try again.");
                                  })
                                  .finally(() => {
                                    setSearchLoading(false);
                                    searchInProgressRef.current = false;
                                  });
                              }}
                            >
                              {r.recipe_label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {searchModalOpen && (
                  <motion.div
                    className="search-fullscreen-modal"
                    role="dialog"
                    aria-modal="true"
                    initial={{ y: "-14%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-14%", opacity: 0 }}
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {hasSearchInputText && (
                      <p className="search-inline-query">
                        Search: <span>{displayQuery || text.trim()}</span>
                      </p>
                    )}
                    <div className="search-fullscreen-modal-body">
                      {!hasSearchInputText && (
                        <div className="search-empty-state">
                          <Image
                            src="/images/eat-healthy--work-eat-healthy.svg"
                            alt="Healthy cooking illustration"
                            width={340}
                            height={340}
                            className="search-empty-illustration"
                            priority
                          />
                          <p className="search-empty search-empty-copy">Start typing to search recipes.</p>
                        </div>
                      )}
                      {searchLoading && searchResults === null && <p className="search-loading">Searching...</p>}
                      {searchSlowMessage && (
                        <p className="search-loading search-slow-hint" role="status">
                          Taking longer than usual. If this persists, ensure migration 008 (search indexes) is applied.
                        </p>
                      )}
                      {searchError && !searchLoading && (
                        <p className="search-empty" role="alert">
                          {searchError}
                        </p>
                      )}

                      {searchResults !== null && !searchError && (
                        <>
                          {searchLoading && <p className="search-updating">Updating results...</p>}
                          {searchResults.length === 0 ? (
                            <p className="search-empty">No recipes found. Try a different search.</p>
                          ) : (
                            <div className="data-content search-results-grid search-results-grid-modal">
                              {searchResults.map((recipe) => (
                                <motion.div
                                  key={recipe.id}
                                  whileHover={cardHoverMotion}
                                  transition={cardHoverTransition}
                                >
                                  <RecipeListCard
                                    recipe={recipe}
                                    isHearted={favoriteIds.has(recipe.recipe_id)}
                                    onFavoriteChange={handleFavoriteChange}
                                  />
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <div className="home-dashboard-grid">
            <section className="home-surface-card home-block-card home-stats-panel">
              <div className="home-stats-row">
                <div className="home-stats-grid">
                  <div className="home-stat-box">
                    <p className="home-stat-label">Total Recipes Saved</p>
                    <p className="home-stat-value">{homeStats.totalRecipesSaved}</p>
                  </div>
                  <div className="home-stat-box">
                    <p className="home-stat-label">Favorites Count</p>
                    <p className="home-stat-value">{homeStats.favoritesCount}</p>
                  </div>
                  <div className="home-stat-box">
                    <p className="home-stat-label">Most Common Cuisine</p>
                    <p className="home-stat-value home-stat-text">{homeStats.mostCommonCuisine}</p>
                  </div>
                <div className="home-stat-box">
                    <p className="home-stat-label">Top 2 Most Viewed</p>
                    {homeStats.topViewed.length > 0 ? (
                      <ol className="home-top-viewed-list">
                        {homeStats.topViewed.map((recipe) => (
                          <li key={recipe.recipe_id}>{recipe.recipe_label}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="home-section-empty">No recipe activity yet.</p>
                    )}
                  </div>
                </div>
                <Link href="/dashboard/create-recipe" className="home-create-recipe-btn">
                  <span aria-hidden>+</span>
                  Create Recipe
                </Link>
              </div>
            </section>

            <section className="home-surface-card home-block-card home-video-panel">
              <h2 className="home-section-title">Video Extraction</h2>
              <p className="home-section-caption">Paste a TikTok URL and submit to start recipe extraction.</p>
              <form className="home-url-import-form" onSubmit={handleVideoImportSubmit}>
                <input
                  type="url"
                  className="home-url-input"
                  placeholder="https://www.tiktok.com/..."
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  required
                />
                <button type="submit" className="home-primary-cta" disabled={videoImportLoading}>
                  {videoImportLoading ? "Starting..." : "Submit Video URL"}
                </button>
              </form>
              {videoImportError && <p className="home-section-empty home-error-text">{videoImportError}</p>}
              {videoImportSuccess && <p className="home-section-empty home-success-text">{videoImportSuccess}</p>}
            </section>

            <section className="home-surface-card home-block-card">
              <h2 className="home-section-title">URL Recipe Extraction</h2>
              <p className="home-section-caption">Paste a recipe URL and preview extracted details in a modal.</p>
              <form className="home-url-import-form" onSubmit={handleUrlImportSubmit}>
                <input
                  type="url"
                  className="home-url-input"
                  placeholder="https://example.com/recipe"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  required
                />
                <button type="submit" className="home-primary-cta" disabled={urlImportLoading}>
                  {urlImportLoading ? "Importing..." : "Submit URL"}
                </button>
              </form>
              {urlImportError && <p className="home-section-empty home-error-text">{urlImportError}</p>}
            </section>

            <section className="home-surface-card home-block-card home-liked-panel">
              <h2 className="home-section-title">Liked Recipes and Folders</h2>

              <div className="home-folder-pill-row">
                {foldersWithCounts.length > 0 ? (
                  foldersWithCounts.map((f) => (
                    <Link
                      key={f.folderName}
                      href={`/dashboard/cookbook/${encodeURIComponent(f.folderName)}`}
                      className="home-folder-pill"
                    >
                      <span>{f.folderName}</span>
                      <strong>{f.count}</strong>
                    </Link>
                  ))
                ) : (
                  <p className="home-section-empty">Create folders in Cookbooks to organize your recipes.</p>
                )}
              </div>

              {favorites.length > 0 ? (
                <div className="home-section-scroll home-liked-scroll">
                  {favorites.map((recipe) => (
                    <motion.div
                      key={recipe.id}
                      className="home-card"
                      whileHover={cardHoverMotion}
                      transition={cardHoverTransition}
                    >
                      <RecipeListCard recipe={recipe} isHearted onFavoriteChange={handleFavoriteChange} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="home-section-empty">Like recipes to pin them here.</p>
              )}
            </section>

            <section className="home-surface-card home-block-card home-upcoming-panel">
              <h2 className="home-section-title">Upcoming Recipes</h2>
              {upcomingMealPlans.length > 0 ? (
                <div className="home-upcoming-days">
                  {upcomingMealPlans.map((day) => (
                    <div key={day.date} className="home-upcoming-day-group">
                      <p className="home-upcoming-label">
                        {day.isToday ? "Scheduled for Today" : `Scheduled for ${day.label}`}
                      </p>
                      <ul className="home-upcoming-list">
                        {day.recipes.map((recipe, idx) => (
                          <li
                            key={`${day.date}-${recipe.eventID}-${recipe.recipe_id}-${idx}`}
                            className="home-upcoming-list-item"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={recipe.image_url || "/images/recipe-placeholder.png"}
                              alt={recipe.recipe_label}
                              className="home-upcoming-list-image"
                            />
                            <span className="home-upcoming-list-title">{recipe.recipe_label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="home-section-empty">No meals scheduled yet. Add recipes in Calendar.</p>
              )}
            </section>

            <section className="home-surface-card home-block-card home-recommended-panel">
              <h2 className="home-section-title">Recommended Recipes</h2>
              {suggestedLoading ? (
                <p className="home-section-loading">Loading recommendations...</p>
              ) : suggestedRecipes.length > 0 ? (
                <div className="home-recommendations-wrapper">
                  {recommendationsScroll.canScrollLeft && (
                    <button
                      type="button"
                      className="home-recommendations-arrow home-recommendations-arrow-left"
                      onClick={() => scrollRecommendations("left")}
                      aria-label="Scroll left"
                    >
                      <span aria-hidden>‹</span>
                    </button>
                  )}
                  <div ref={recommendationsScrollRef} className="home-section-scroll home-recommendations-scroll">
                    {suggestedRecipes.map((recipe) => (
                      <motion.div
                        key={recipe.id}
                        className="home-recommendation-card"
                        whileHover={cardHoverMotion}
                        transition={cardHoverTransition}
                      >
                        <RecipeListCard
                          recipe={recipe}
                          isHearted={favoriteIds.has(recipe.recipe_id)}
                          onFavoriteChange={handleFavoriteChange}
                        />
                      </motion.div>
                    ))}
                  </div>
                  {recommendationsScroll.canScrollRight && (
                    <button
                      type="button"
                      className="home-recommendations-arrow home-recommendations-arrow-right"
                      onClick={() => scrollRecommendations("right")}
                      aria-label="Scroll right"
                    >
                      <span aria-hidden>›</span>
                    </button>
                  )}
                </div>
              ) : (
                <p className="home-section-empty">Run import scripts to add recipes and unlock recommendations.</p>
              )}
            </section>
          </div>

          {showUrlPreviewModal && urlPreview && (
            <div className="home-url-modal-backdrop" onClick={() => setShowUrlPreviewModal(false)}>
              <div
                className="home-url-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Imported URL recipe preview"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="home-url-modal-head">
                  <h3>{urlPreview.title || "Untitled recipe"}</h3>
                  <button
                    type="button"
                    className="search-results-clear"
                    onClick={() => setShowUrlPreviewModal(false)}
                  >
                    Close
                  </button>
                </div>

                {urlPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlPreview.image} alt={urlPreview.title || "Imported recipe"} className="home-url-modal-image" />
                )}

                <p className="home-url-modal-meta">
                  Source:{" "}
                  <a href={urlPreview.source_url} target="_blank" rel="noreferrer">
                    {urlPreview.source_url}
                  </a>
                </p>

                <div className="home-url-modal-tags">
                  {urlPreview.total_time_minutes ? <span>{urlPreview.total_time_minutes} min</span> : null}
                  {urlPreview.calories ? <span>{urlPreview.calories}</span> : null}
                  {urlPreview.yields ? <span>{urlPreview.yields}</span> : null}
                </div>

                <div className="home-url-modal-grid">
                  <div>
                    <h4>Ingredients</h4>
                    <ul>
                      {urlPreview.ingredients.slice(0, 12).map((item, idx) => (
                        <li key={`${idx}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Instructions</h4>
                    <ol>
                      {(urlPreview.instructions_list.length > 0
                        ? urlPreview.instructions_list
                        : (urlPreview.instructions ?? "")
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                      )
                        .slice(0, 8)
                        .map((step, idx) => (
                          <li key={`${idx}-${step}`}>{step}</li>
                        ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
