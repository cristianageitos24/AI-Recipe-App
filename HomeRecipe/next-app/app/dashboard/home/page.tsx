"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { RecipeListCard } from "@/components/RecipeListCard";
import { RecipeFullView } from "@/components/RecipeFullView";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import { VideoUploadForm } from "@/components/VideoUploadForm";
import { getHomeBootstrap } from "@/app/actions/dashboard";
import {
  getSearchSuggestions,
  getIngredientSuggestions,
  searchRecipes,
  searchByIngredients,
} from "@/app/actions/search";
import {
  buildUrlImportRecipePayload,
  isUrlImportSaveable,
  urlImportToDraftRecipeRow,
} from "@/lib/processRecipeData";
import type { RecipeRow, UrlImportedRecipe, WebRecipeSearchResult } from "@/lib/types";
import "@/app/styling/TabHome.css";
import "@/app/styling/VideoUpload.css";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/CookbookPageRecipeCard.css";

type FolderWithCount = { folderName: string; count: number };
type SearchMode = "recipe" | "ingredients" | "web";
type MealDay = { date: string; recipes: Array<RecipeRow & { eventID: string }> };

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

function parseDateKey(dateKey: string): { monthAbbr: string; dayNum: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(year, month - 1, day, 12);
  return {
    monthAbbr: dt.toLocaleDateString("en", { month: "short" }).toUpperCase(),
    dayNum: dt.getDate(),
  };
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

async function searchWebRecipes(query: string): Promise<WebRecipeSearchResult[]> {
  const res = await fetch("/api/recipes/web-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = (await res.json()) as {
    results?: WebRecipeSearchResult[];
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || "Web recipe search failed.");
  }

  return data.results ?? [];
}

export default function DashboardHomePage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  const [searchMode, setSearchMode] = useState<SearchMode>("recipe");
  const [text, setText] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [displayQuery, setDisplayQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeRow[] | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<WebRecipeSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importingWebUrl, setImportingWebUrl] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlImportedRecipe | null>(null);
  const [showUrlPreviewModal, setShowUrlPreviewModal] = useState(false);
  const [urlSaveModalOpen, setUrlSaveModalOpen] = useState(false);
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

  const urlImportPayload = useMemo(
    () => (urlPreview ? buildUrlImportRecipePayload(urlPreview) : null),
    [urlPreview]
  );
  const urlDraftRecipeRow = useMemo(
    () => (urlImportPayload ? urlImportToDraftRecipeRow(urlImportPayload) : null),
    [urlImportPayload]
  );
  const urlImportCanSave = isUrlImportSaveable(urlPreview);

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

    const now = new Date();
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let recipesThisWeek = 0;
    let importedThisMonth = 0;
    for (const recipe of savedMap.values()) {
      if (recipe.created_at) {
        const createdAt = new Date(recipe.created_at);
        if (createdAt >= oneWeekAgo) recipesThisWeek++;
        if (createdAt >= startOfMonth) importedThisMonth++;
      }
    }

    return {
      totalRecipesSaved: savedMap.size,
      favoritesCount: favorites.length,
      mostCommonCuisine,
      topViewed,
      recipesThisWeek,
      importedThisMonth,
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
    if (searchMode === "web") {
      setSuggestions({ ingredients: [], recipes: [] });
      setShowSuggestions(false);
      return;
    }
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
    if (searchMode === "web") {
      if (trimmed.length < 3) {
        setWebSearchResults(null);
        setDisplayQuery("");
      }
      return;
    }
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
        setWebSearchResults(null);
        setDisplayQuery("");
        setSearchError(null);
        return;
      }
    } else if (trimmed.length < 2) {
      setSearchResults(null);
      setWebSearchResults(null);
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
      setWebSearchResults(null);
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
      setWebSearchResults(null);
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
      setWebSearchResults(null);
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
    } else if (searchMode === "web") {
      const query = text.trim();
      if (query.length < 3) {
        searchInProgressRef.current = false;
        setWebSearchResults(null);
        setDisplayQuery("");
        return;
      }
      setSearchLoading(true);
      setDisplayQuery(query);
      setSearchResults(null);
      try {
        const results = await searchWebRecipes(query);
        setWebSearchResults(results);
      } catch (error) {
        setWebSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Web search failed. Try again.");
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
      setWebSearchResults(null);
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

  function changeSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setSearchResults(null);
    setWebSearchResults(null);
    setSearchError(null);
    setSearchSlowMessage(false);
    setSuggestions({ ingredients: [], recipes: [] });
    setShowSuggestions(false);
    searchInProgressRef.current = false;
  }

  function closeSearchModalAndReset() {
    setSearchModalOpen(false);
    setShowSuggestions(false);
    setText("");
    setDisplayQuery("");
    setSearchResults(null);
    setWebSearchResults(null);
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

  const importRecipeFromWebUrl = useCallback(async (url: string) => {
    const res = await fetch("/api/recipes/import-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json()) as UrlImportedRecipe | { error?: string };
    if (!res.ok) {
      throw new Error("error" in data && data.error ? data.error : "Failed to import recipe URL");
    }
    setUrlPreview(data as UrlImportedRecipe);
    setUrlSaveModalOpen(false);
    setShowUrlPreviewModal(true);
  }, []);

  const handleImportWebResult = useCallback(
    async (url: string) => {
      setImportingWebUrl(url);
      setSearchError(null);
      try {
        await importRecipeFromWebUrl(url);
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : "Import failed. Try another result.");
      } finally {
        setImportingWebUrl(null);
      }
    },
    [importRecipeFromWebUrl],
  );

  const hasSuggestions = suggestions.ingredients.length > 0 || suggestions.recipes.length > 0;
  const hasSearchInputText = text.trim().length > 0;
  const cardHoverMotion = { y: -4 };
  const cardHoverTransition = { duration: 0.18, ease: "easeOut" as const };

  return (
    <div className="main-panel home-main-panel">
        <motion.div
          className="recipe-search-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Search bar */}
          <section className="home-dashboard-header">
            <div className="home-search-shell">
              <div className="search-mode-tabs">
                <button
                  type="button"
                  className={`search-mode-tab ${searchMode === "recipe" ? "active" : ""}`}
                  onClick={() => changeSearchMode("recipe")}
                >
                  Recipe name
                </button>
                <button
                  type="button"
                  className={`search-mode-tab ${searchMode === "ingredients" ? "active" : ""}`}
                  onClick={() => changeSearchMode("ingredients")}
                >
                  Ingredients
                </button>
                <button
                  type="button"
                  className={`search-mode-tab ${searchMode === "web" ? "active" : ""}`}
                  onClick={() => changeSearchMode("web")}
                >
                  Web
                </button>
              </div>

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
                          ? "Search recipes, ingredients, cuisines..."
                          : searchMode === "web"
                            ? "Search the web for recipes..."
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
                        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" strokeLinecap="round">
                          <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="7" cy="5" r="2" fill="var(--color-bg)" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="13" cy="10" r="2" fill="var(--color-bg)" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="9" cy="15" r="2" fill="var(--color-bg)" stroke="currentColor" strokeWidth="1.5"/>
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
                      {searchLoading &&
                        (searchMode === "web" ? webSearchResults === null : searchResults === null) && (
                          <p className="search-loading">Searching...</p>
                        )}
                      {searchSlowMessage && (
                        <p className="search-loading search-slow-hint" role="status">
                          {searchMode === "web"
                            ? "Still searching the web. Some recipe sites take a little longer to resolve."
                            : "Taking longer than usual. If this persists, ensure migration 008 (search indexes) is applied."}
                        </p>
                      )}
                      {searchError && !searchLoading && (
                        <p className="search-empty" role="alert">
                          {searchError}
                        </p>
                      )}

                      {searchMode === "web" && webSearchResults !== null && !searchError && (
                        <>
                          {searchLoading && <p className="search-updating">Updating results...</p>}
                          {webSearchResults.length === 0 ? (
                            <p className="search-empty">No web recipes found. Try a different search.</p>
                          ) : (
                            <div className="web-recipe-results-grid">
                              {webSearchResults.map((result) => (
                                <motion.article
                                  key={result.id}
                                  className="web-recipe-result-card"
                                  whileHover={cardHoverMotion}
                                  transition={cardHoverTransition}
                                >
                                  <div className="web-recipe-result-image-wrap">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={result.image || "/images/recipe-placeholder.png"}
                                      alt=""
                                      className="web-recipe-result-image"
                                      onError={(event) => {
                                        event.currentTarget.src = "/images/recipe-placeholder.png";
                                      }}
                                    />
                                  </div>
                                  <div className="web-recipe-result-body">
                                    <p className="web-recipe-result-source">{result.source}</p>
                                    <h3 className="web-recipe-result-title">{result.title}</h3>
                                    {result.snippet && (
                                      <p className="web-recipe-result-snippet">{result.snippet}</p>
                                    )}
                                    <div className="web-recipe-result-actions">
                                      <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="web-recipe-result-link"
                                      >
                                        View source
                                      </a>
                                      <button
                                        type="button"
                                        className="web-recipe-import-btn"
                                        onClick={() => handleImportWebResult(result.url)}
                                        disabled={importingWebUrl !== null}
                                      >
                                        {importingWebUrl === result.url ? "Importing..." : "Import"}
                                      </button>
                                    </div>
                                  </div>
                                </motion.article>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {searchMode !== "web" && searchResults !== null && !searchError && (
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

          {/* Welcome row */}
          <div className="home-welcome-row">
            <div>
              <h1 className="home-welcome-heading">Welcome back, {firstName} <span style={{ marginLeft: "4px" }}>👋</span></h1>
              <p className="home-welcome-sub">Let&apos;s make today delicious.</p>
            </div>
            <Link href="/dashboard/create-recipe" className="home-create-recipe-btn">
              <span aria-hidden>+</span> Create Recipe
            </Link>
          </div>

          {/* Stats cards */}
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
                <p className="home-stat-card-value">{homeStats.totalRecipesSaved}</p>
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
                <p className="home-stat-card-value">{homeStats.favoritesCount}</p>
                <p className="home-stat-card-link home-stat-card-link-green">
                  {homeStats.favoritesCount === 0 ? "No favorites yet" : "View your favorites"}
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
                <p className="home-stat-card-value">{homeStats.recipesThisWeek}</p>
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
                <p className="home-stat-card-value">{homeStats.importedThisMonth}</p>
                <Link href="/dashboard/recipes" className="home-stat-card-link home-stat-card-link-blue">
                  Add some new recipes
                </Link>
              </div>
            </div>
          </div>

          {/* Import a Recipe card */}
          <section className="home-surface-card home-import-card">
            <div className="home-import-content">
              <div className="home-import-icon-circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <h2 className="home-section-title">Import a Recipe</h2>
              <p className="home-section-caption">
                Paste a TikTok link or any recipe webpage URL and we&apos;ll do the rest.
              </p>
            </div>
            <div className="home-import-form">
              <VideoUploadForm
                variant="embedded-unified"
                onWebRecipeUrlImport={importRecipeFromWebUrl}
              />
            </div>
            <div className="home-import-decoration" aria-hidden="true">
              <Image
                src="/images/dashboard/salad_stock.png"
                alt=""
                width={220}
                height={220}
                className="home-import-decoration-img"
              />
            </div>
          </section>

          {/* Collections + Upcoming side by side */}
          <div className="home-lower-grid">
            {/* Your Collections */}
            <section className="home-surface-card home-collections-panel">
              <div className="home-collections-header">
                <div>
                  <div className="home-collections-title-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="home-collections-icon" aria-hidden="true">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <h2 className="home-section-title">Your Collections</h2>
                  </div>
                  <p className="home-section-caption">Quick access to your saved collections</p>
                </div>
                <Link href="/dashboard/cookbook" className="home-view-all-btn">View all</Link>
              </div>
              <div className="home-collections-grid">
                {foldersWithCounts.length > 0 ? (
                  foldersWithCounts.map((f) => (
                    <Link
                      key={f.folderName}
                      href={`/dashboard/cookbook/${encodeURIComponent(f.folderName)}`}
                      className="home-collection-card"
                    >
                      <p className="home-collection-name">{f.folderName}</p>
                      <p className="home-collection-count">{f.count}</p>
                    </Link>
                  ))
                ) : (
                  <p className="home-section-empty">Create folders in Cookbooks to organize your recipes.</p>
                )}
              </div>
            </section>

            {/* Upcoming Recipes */}
            <section className="home-surface-card home-upcoming-panel">
              <div className="home-upcoming-panel-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="home-collections-icon" aria-hidden="true">
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
                <p className="home-section-empty">No meals scheduled yet. Add recipes in Calendar.</p>
              )}
            </section>
          </div>

          {showUrlPreviewModal && urlPreview && urlDraftRecipeRow && (
            <>
              <div
                className="recipe-full-view-overlay"
                onClick={() => {
                  setShowUrlPreviewModal(false);
                  setUrlSaveModalOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowUrlPreviewModal(false);
                    setUrlSaveModalOpen(false);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Close imported recipe"
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
                    <button
                      type="button"
                      className="search-results-clear"
                      onClick={() => {
                        setShowUrlPreviewModal(false);
                        setUrlSaveModalOpen(false);
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="submit-button video-recipe-save-btn"
                      style={{ margin: 0 }}
                      disabled={!urlImportCanSave}
                      onClick={() => setUrlSaveModalOpen(true)}
                    >
                      Save to cookbook
                    </button>
                  </div>
                  <RecipeFullView
                    recipeData={urlDraftRecipeRow}
                    onClose={() => {
                      setShowUrlPreviewModal(false);
                      setUrlSaveModalOpen(false);
                    }}
                  />
                </div>
              </div>
              <SaveRecipeToCookbookModal
                open={urlSaveModalOpen}
                onClose={() => setUrlSaveModalOpen(false)}
                payload={urlSaveModalOpen && urlImportPayload ? urlImportPayload : null}
              />
            </>
          )}
        </motion.div>
    </div>
  );
}
