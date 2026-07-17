"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { RecipeListCard } from "@/components/RecipeListCard";
import type { RecipeRow } from "@/lib/types";
import type { useHomeSearch } from "../_hooks/useHomeSearch";

type SearchState = ReturnType<typeof useHomeSearch>;

interface HomeSearchShellProps extends SearchState {
  favoriteIds: Set<string>;
  onFavoriteChange: (recipe: RecipeRow, isFavorited: boolean) => void;
  webSearchLocked?: boolean;
  onWebSearchLocked?: () => void;
}

const cardHoverMotion = { y: -4 };
const cardHoverTransition = { duration: 0.18, ease: "easeOut" as const };

export function HomeSearchShell({
  text, setText, searchMode, selectedIngredients,
  displayQuery, searchResults, webSearchResults,
  searchLoading, searchError, searchSlowMessage,
  searchModalOpen, setSearchModalOpen,
  suggestions, showSuggestions, setShowSuggestions,
  importingWebUrl, hasSuggestions, hasSearchInputText,
  inputRef, suggestionsRef,
  handleSearch, handleKeyDown,
  addIngredient, removeIngredient, changeSearchMode,
  closeSearchModalAndReset, handleImportWebResult,
  favoriteIds, onFavoriteChange,
  webSearchLocked = false,
  onWebSearchLocked,
}: HomeSearchShellProps) {
  return (
    <section className="home-dashboard-header">
      <div className="home-search-shell">
        {/* Mode tabs */}
        <div className="search-mode-tabs">
          {(["recipe", "ingredients", "web"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`search-mode-tab ${searchMode === mode ? "active" : ""}`}
              onClick={() => {
                if (mode === "web" && webSearchLocked) {
                  onWebSearchLocked?.();
                  return;
                }
                changeSearchMode(mode);
              }}
            >
              {mode === "recipe"
                ? "Recipe name"
                : mode === "ingredients"
                  ? "Ingredients"
                  : webSearchLocked
                    ? "Web (Pro)"
                    : "Web"}
            </button>
          ))}
        </div>

        {/* Ingredient chips */}
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

        {/* Search input */}
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
              onChange={(e) => { setText(e.target.value); setShowSuggestions(true); }}
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
              onClick={() => { searchModalOpen ? closeSearchModalAndReset() : handleSearch(); }}
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

          {/* Autocomplete */}
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
                        if (searchMode === "ingredients") { addIngredient(ing); return; }
                        setText(ing);
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
                        handleSearch();
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

        {/* Fullscreen search modal */}
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
                  <p className="search-empty" role="alert">{searchError}</p>
                )}

                {/* Web results */}
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
                                onError={(e) => { e.currentTarget.src = "/images/recipe-placeholder.png"; }}
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

                {/* Recipe results */}
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
                              onFavoriteChange={onFavoriteChange}
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
  );
}
