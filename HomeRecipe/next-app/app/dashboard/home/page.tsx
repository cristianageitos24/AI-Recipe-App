"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HeartButton } from "@/components/HeartButton";
import { SaveToFolderButton } from "@/components/SaveToFolderButton";
import { FavoriteCard } from "@/components/FavoriteCard";
import { recipeRowToProcessed } from "@/lib/processRecipeData";
import { getFolders } from "@/app/actions/folders";
import { getFavorites } from "@/app/actions/favorites";
import {
  getSearchSuggestions,
  getIngredientSuggestions,
  searchRecipes,
  searchByIngredients,
  getSuggestedRecipes,
} from "@/app/actions/search";
import type { RecipeRow } from "@/lib/types";
import { formatRecipeTitleTwoWordsPerLine } from "@/lib/formatRecipeTitle";
import "@/app/styling/TabHome.css";

function capitalizeFirstLetter(string: string): string {
  if (string.includes("/")) {
    string = string.replace(/\/(.)/g, (_, char: string) => `/${char.toUpperCase()}`);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

type FolderWithCount = { folderName: string; count: number };

type SearchMode = "recipe" | "ingredients";

function ResultPic({
  imageUrl,
  alt,
}: {
  imageUrl: string | null | undefined;
  alt: string;
}) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);
  if (!imageUrl || imageError) {
    return <img className="result-pic result-pic-placeholder" src="/images/recipe-placeholder.png" alt="" aria-hidden />;
  }
  return (
    <img
      className="result-pic"
      src={imageUrl}
      alt={alt}
      onError={() => setImageError(true)}
    />
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function DashboardHomePage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("recipe");
  const [text, setText] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [displayQuery, setDisplayQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [foldersWithCounts, setFoldersWithCounts] = useState<FolderWithCount[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeRow[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    ingredients: string[];
    recipes: { recipe_id: string; recipe_label: string }[];
  }>({ ingredients: [], recipes: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRequestIdRef = useRef(0);
  const searchInProgressRef = useRef(false);
  const [searchSlowMessage, setSearchSlowMessage] = useState(false);
  const [recommendationsScroll, setRecommendationsScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);

  const debouncedText = useDebounce(text, 450);

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
    getFolders().then((res) => {
      if (res.data?.folders) setFolderOptions(res.data.folders);
      if (res.data?.folders && res.data?.results) {
        const folders = res.data.folders as string[];
        const results = res.data.results as Record<string, unknown[]>;
        setFoldersWithCounts(
          folders.map((name) => ({ folderName: name, count: (results[name] ?? []).length }))
        );
      }
    });
  }, []);

  useEffect(() => {
    getFavorites().then((res) => {
      if (res.data) setFavorites(res.data);
    });
  }, []);

  useEffect(() => {
    setSuggestedLoading(true);
    Promise.all([getFavorites(), getFolders()])
      .then(([favRes, foldRes]) => {
        const savedIds = new Set<string>();
        (favRes.data ?? []).forEach((r: RecipeRow) => savedIds.add(r.recipe_id));
        const results = (foldRes.data?.results ?? {}) as Record<string, RecipeRow[]>;
        (foldRes.data?.folders ?? []).forEach((name: string) => {
          (results[name] ?? []).forEach((r: RecipeRow) => savedIds.add(r.recipe_id));
        });
        return getSuggestedRecipes(Array.from(savedIds));
      })
      .then((res) => {
        if (res.data) setSuggestedRecipes(res.data);
      })
      .catch(() => setSuggestedRecipes([]))
      .finally(() => setSuggestedLoading(false));
  }, []);

  useEffect(() => {
    if (searchInProgressRef.current) return;
    const trimmed = debouncedText.trim();
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
  }, [debouncedText, searchMode]);

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

  const hasSuggestions =
    suggestions.ingredients.length > 0 || suggestions.recipes.length > 0;

  function RecipeCard({ recipe }: { recipe: RecipeRow }) {
    const info = recipeRowToProcessed(recipe);
    return (
      <div className="results-content">
        <ResultPic imageUrl={recipe.image_url} alt={recipe.recipe_label} />
<div className="results-labels">
                      <h1 className="recipe-title-two-words">{formatRecipeTitleTwoWordsPerLine(recipe.recipe_label)}</h1>
          <div className="label-details">
            <h3>{capitalizeFirstLetter(recipe.cuisine_type ?? "")}</h3>
            <h3>{capitalizeFirstLetter(recipe.meal_type ?? "")}</h3>
          </div>
          <div className="label-details">
            <h3>{recipe.calories} calories</h3>
            {recipe.time_in_minutes < 1 ? (
              <h3 className="green-light">1 minute</h3>
            ) : recipe.time_in_minutes <= 10 ? (
              <h3 className="green-light">{recipe.time_in_minutes} minutes</h3>
            ) : recipe.time_in_minutes <= 30 ? (
              <h3 className="yellow-light">{recipe.time_in_minutes} minutes</h3>
            ) : (
              <h3 className="red-light">{recipe.time_in_minutes} minutes</h3>
            )}
          </div>
        </div>
        <div className="result-buttons">
          <button
            type="button"
            className="open-recipe-link-btn"
            onClick={() => window.open(recipe.website_url ?? "", "_blank")}
          >
            Show Recipe
          </button>
          <div className="save-folder-btns">
            <div className="heart-btn-search-results-card">
              <HeartButton recipeData={info} heartStyle={{ top: "50%" }} />
            </div>
            <SaveToFolderButton
              folders={[...new Set(folderOptions)]}
              recipeData={info}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="right-side-panel">
      <div className="recipe-search-content">
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
        <div className="search-container search-autocomplete-wrapper">
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
          <div className="search-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                searchMode === "recipe"
                  ? "Search recipes by name..."
                  : "Add ingredients (type or select)"
              }
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => hasSuggestions && setShowSuggestions(true)}
              className="search-txt"
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              type="button"
              className="search-btn"
              onClick={handleSearch}
              disabled={searchLoading}
              aria-busy={searchLoading}
              title="Search"
            >
              <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M17.71 16.29L14.31 12.9C15.407 11.5025 16.0022 9.77666 16 8C16 6.41775 15.5308 4.87103 14.6518 3.55544C13.7727 2.23985 12.5233 1.21447 11.0615 0.608967C9.59966 0.00346625 7.99113 -0.15496 6.43928 0.153721C4.88743 0.462403 3.46197 1.22433 2.34315 2.34315C1.22433 3.46197 0.462403 4.88743 0.153721 6.43928C-0.15496 7.99113 0.00346625 9.59966 0.608967 11.0615C1.21447 12.5233 2.23985 13.7727 3.55544 14.6518C4.87103 15.5308 6.41775 16 8 16C9.77666 16.0022 11.5025 15.407 12.9 14.31L16.29 17.71C16.383 17.8037 16.4936 17.8781 16.6154 17.9289C16.7373 17.9797 16.868 18.0058 17 18.0058C17.132 18.0058 17.2627 17.9797 17.3846 17.9289C17.5064 17.8781 17.617 17.8037 17.71 17.71C17.8037 17.617 17.8781 17.5064 17.9289 17.3846C17.9797 17.2627 18.0058 17.132 18.0058 17C18.0058 16.868 17.9797 16.7373 17.9289 16.6154C17.8781 16.4936 17.8037 16.383 17.71 16.29ZM2 8C2 6.81332 2.3519 5.65328 3.01119 4.66658C3.67047 3.67989 4.60755 2.91085 5.7039 2.45673C6.80026 2.0026 8.00666 1.88378 9.17055 2.11529C10.3344 2.3468 11.4035 2.91825 12.2426 3.75736C13.0818 4.59648 13.6532 5.66558 13.8847 6.82946C14.1162 7.99335 13.9974 9.19975 13.5433 10.2961C13.0892 11.3925 12.3201 12.3295 11.3334 12.9888C10.3467 13.6481 9.18669 14 8 14C6.4087 14 4.88258 13.3679 3.75736 12.2426C2.63214 11.1174 2 9.5913 2 8Z"
                  fill="black"
                />
              </svg>
            </button>
          </div>
          {searchMode === "ingredients" && (
            <p className="search-autofill-hint">Type to see ingredients; click to add.</p>
          )}
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
                      onClick={() => addIngredient(ing)}
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

        {searchLoading && (
          <>
            <p className="search-loading">Searching...</p>
            {searchSlowMessage && (
              <p className="search-loading search-slow-hint" role="status">
                Taking longer than usual. If this persists, ensure Supabase migration 008 (search indexes) is applied.
              </p>
            )}
          </>
        )}
        {searchError && !searchLoading && (
          <p className="search-empty" role="alert">{searchError}</p>
        )}
        {searchResults !== null && !searchLoading && !searchError && (
          <div>
            <h1 className="search-looking">
              Searched: <span>{displayQuery}</span>
            </h1>
            {searchResults.length === 0 ? (
              <p className="search-empty">No recipes found. Try a different search.</p>
            ) : (
              <div className="data-content">
                {searchResults.map((recipe) => (
                  <motion.div key={recipe.id} whileHover={{ scale: 1.02 }}>
                    <RecipeCard recipe={recipe} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {favorites.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">Favorites</h2>
            <div className="home-section-scroll">
              {favorites.map((recipe) => (
                <motion.div
                  key={recipe.id}
                  className="home-card"
                  whileHover={{ scale: 1.02 }}
                >
                  <FavoriteCard
                    recipe={recipe}
                    folders={[...new Set(folderOptions)]}
                    isHearted
                  />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {foldersWithCounts.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">Your Cookbooks</h2>
            <div className="home-section-scroll home-cookbooks-row">
              {foldersWithCounts.map((f) => (
                <Link
                  key={f.folderName}
                  href={`/dashboard/cookbook/${encodeURIComponent(f.folderName)}`}
                  className="home-cookbook-card"
                >
                  <span className="home-cookbook-name">{f.folderName}</span>
                  <span className="home-cookbook-count">
                    {f.count} recipe{f.count !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <h2 className="home-section-title">Recommended for you</h2>
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
                  <img src="/images/dashboard/arrow.svg" alt="" style={{ transform: "scaleX(-1)" }} />
                </button>
              )}
              <div
                ref={recommendationsScrollRef}
                className="home-section-scroll home-recommendations-scroll"
              >
                {suggestedRecipes.map((recipe) => (
                  <motion.div key={recipe.id} className="home-recommendation-card" whileHover={{ scale: 1.02 }}>
                    <RecipeCard recipe={recipe} />
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
                  <img src="/images/dashboard/arrow.svg" alt="" />
                </button>
              )}
            </div>
          ) : (
            <p className="home-section-empty">
              Run the import scripts to add recipes. See README for instructions.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
