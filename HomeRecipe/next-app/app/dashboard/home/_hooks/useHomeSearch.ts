"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import type { RecipeRow, UrlImportedRecipe, WebSearchResult } from "@/lib/types";
import type { PlanLimitReason } from "@/lib/entitlements-constants";

export type SearchMode = "recipe" | "ingredients" | "web";

type UseHomeSearchOptions = {
  onPlanLimit?: (reason: PlanLimitReason) => void;
  onExtractSuccess?: () => void;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

async function fetchWebRecipes(query: string): Promise<WebSearchResult[]> {
  const res = await fetch("/api/search/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = (await res.json()) as {
    results?: WebSearchResult[];
    error?: string;
    code?: string;
    reason?: PlanLimitReason;
  };
  if (res.status === 403 && data.code === "PLAN_LIMIT") {
    const err = new Error(data.error || "Plan limit") as Error & {
      planLimitReason?: PlanLimitReason;
    };
    err.planLimitReason = data.reason ?? "catalog";
    throw err;
  }
  if (!res.ok) throw new Error(data.error || "Web recipe search failed.");
  return data.results ?? [];
}

export function useHomeSearch(options: UseHomeSearchOptions = {}) {
  const { onPlanLimit, onExtractSuccess } = options;
  const [searchMode, setSearchMode] = useState<SearchMode>("recipe");
  const [text, setText] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [displayQuery, setDisplayQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeRow[] | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<WebSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSlowMessage, setSearchSlowMessage] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    ingredients: string[];
    recipes: { recipe_id: string; recipe_label: string }[];
  }>({ ingredients: [], recipes: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // URL import state
  const [importingWebUrl, setImportingWebUrl] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<UrlImportedRecipe | null>(null);
  const [showUrlPreviewModal, setShowUrlPreviewModal] = useState(false);
  const [urlSaveModalOpen, setUrlSaveModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionRequestIdRef = useRef(0);
  const liveSearchRequestIdRef = useRef(0);
  const searchInProgressRef = useRef(false);

  const debouncedTextForSuggestions = useDebounce(text, 150);
  const debouncedTextForSearch = useDebounce(text, 400);

  const urlImportPayload = useMemo(
    () => (urlPreview ? buildUrlImportRecipePayload(urlPreview) : null),
    [urlPreview]
  );
  const urlDraftRecipeRow = useMemo(
    () => (urlImportPayload ? urlImportToDraftRecipeRow(urlImportPayload) : null),
    [urlImportPayload]
  );
  const urlImportCanSave = isUrlImportSaveable(urlPreview);
  const hasSuggestions = suggestions.ingredients.length > 0 || suggestions.recipes.length > 0;
  const hasSearchInputText = text.trim().length > 0;

  // Suggestions
  useEffect(() => {
    if (searchInProgressRef.current) return;
    const trimmed = debouncedTextForSuggestions.trim();
    if (searchMode === "web") { setSuggestions({ ingredients: [], recipes: [] }); return; }
    const minLength = searchMode === "ingredients" ? 1 : 2;
    if (trimmed.length < minLength) {
      setSuggestions({ ingredients: [], recipes: [] });
      return;
    }
    if (inputRef.current && document.activeElement !== inputRef.current) return;
    const requestId = ++suggestionRequestIdRef.current;
    if (searchMode === "ingredients") {
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

  // Live search
  useEffect(() => {
    const trimmed = debouncedTextForSearch.trim();
    const isIngredientMode = searchMode === "ingredients";
    if (searchMode === "web") return;
    const ings =
      selectedIngredients.length > 0
        ? selectedIngredients
        : trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    if (isIngredientMode) {
      if (ings.length === 0) {
        setSearchResults(null);
        setDisplayQuery(""); setSearchError(null);
        return;
      }
    } else if (trimmed.length < 2) {
      setSearchResults(null);
      setDisplayQuery(""); setSearchError(null);
      return;
    }
    setSearchError(null);
    setSearchSlowMessage(false);
    setSearchLoading(true);
    const requestId = ++liveSearchRequestIdRef.current;
    const finish = () => {
      if (requestId === liveSearchRequestIdRef.current) {
        setSearchLoading(false);
        setSearchSlowMessage(false);
      }
    };
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
          setSearchResults([]); setSearchError("Search failed. Try again.");
        })
        .finally(finish);
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
          setSearchResults([]); setSearchError("Search failed. Try again.");
        })
        .finally(finish);
    }
  }, [debouncedTextForSearch, searchMode, selectedIngredients]);

  // Slow search hint
  useEffect(() => {
    if (!searchLoading) { setSearchSlowMessage(false); return; }
    const t = setTimeout(() => setSearchSlowMessage(true), 5000);
    return () => clearTimeout(t);
  }, [searchLoading]);

  // Body scroll lock when modal open
  useEffect(() => {
    if (!searchModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [searchModalOpen]);

  // ESC closes modal
  useEffect(() => {
    if (!searchModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearchModalAndReset();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchModalOpen]);

  // Blur input on page focus restore
  useEffect(() => {
    const blur = () => inputRef.current?.blur();
    requestAnimationFrame(blur);
    window.addEventListener("focus", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("focus", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, []);

  // Click outside to close suggestions
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

  const importRecipeFromWebUrl = useCallback(async (url: string) => {
    const res = await fetch("/api/recipes/import-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json()) as UrlImportedRecipe & {
      error?: string;
      code?: string;
      reason?: PlanLimitReason;
    };
    if (!res.ok) {
      if (res.status === 403 && data.code === "PLAN_LIMIT") {
        onPlanLimit?.(data.reason ?? "extractions");
        throw new Error(data.error || "Extraction limit reached");
      }
      throw new Error(data.error || "Failed to import recipe URL");
    }
    setUrlPreview(data as UrlImportedRecipe);
    setUrlSaveModalOpen(false);
    setShowUrlPreviewModal(true);
    onExtractSuccess?.();
  }, [onExtractSuccess, onPlanLimit]);

  const handleImportWebResult = useCallback(
    async (url: string) => {
      setImportingWebUrl(url);
      setSearchError(null);
      try {
        await importRecipeFromWebUrl(url);
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Import failed. Try another result."
        );
      } finally {
        setImportingWebUrl(null);
      }
    },
    [importRecipeFromWebUrl]
  );

  async function handleSearch() {
    if (searchLoading) return;
    setShowSuggestions(false);
    setSearchError(null);
    setSearchSlowMessage(false);
    searchInProgressRef.current = true;
    if (searchMode === "web") {
      const query = text.trim();
      if (query.length < 3) { searchInProgressRef.current = false; return; }
      setSearchLoading(true);
      setDisplayQuery(query);
      setSearchResults(null);
      try {
        setWebSearchResults(await fetchWebRecipes(query));
      } catch (error) {
        const planReason = (error as Error & { planLimitReason?: PlanLimitReason })
          .planLimitReason;
        if (planReason) onPlanLimit?.(planReason);
        setWebSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Web search failed. Try again.");
      } finally {
        setSearchLoading(false); setSearchSlowMessage(false);
        searchInProgressRef.current = false;
      }
    } else if (searchMode === "recipe") {
      const query = text.trim();
      if (!query) { searchInProgressRef.current = false; return; }
      setSearchLoading(true);
      setDisplayQuery(query);
      setWebSearchResults(null);
      try {
        const res = await searchRecipes(query);
        setSearchResults(res.data ?? []);
      } catch {
        setSearchResults([]); setSearchError("Search failed. Try again.");
      } finally {
        setSearchLoading(false); setSearchSlowMessage(false);
        searchInProgressRef.current = false;
      }
    } else {
      const ings =
        selectedIngredients.length > 0
          ? selectedIngredients
          : text.split(",").map((s) => s.trim()).filter(Boolean);
      if (ings.length === 0) { searchInProgressRef.current = false; return; }
      setSearchLoading(true); setDisplayQuery(ings.join(", ")); setWebSearchResults(null);
      try {
        const res = await searchByIngredients(ings);
        setSearchResults(res.data ?? []);
      } catch {
        setSearchResults([]); setSearchError("Search failed. Try again.");
      } finally {
        setSearchLoading(false); setSearchSlowMessage(false);
        searchInProgressRef.current = false;
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function addIngredient(ing: string) {
    if (!selectedIngredients.includes(ing)) setSelectedIngredients([...selectedIngredients, ing]);
    setText(""); setShowSuggestions(false);
  }

  function removeIngredient(ing: string) {
    setSelectedIngredients(selectedIngredients.filter((i) => i !== ing));
  }

  function changeSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setSearchResults(null); setWebSearchResults(null);
    setSearchError(null); setSearchSlowMessage(false);
    setSuggestions({ ingredients: [], recipes: [] });
    setShowSuggestions(false);
    searchInProgressRef.current = false;
  }

  function closeSearchModalAndReset() {
    setSearchModalOpen(false); setShowSuggestions(false);
    setText(""); setDisplayQuery("");
    setSearchResults(null); setWebSearchResults(null);
    setSearchError(null); setSearchSlowMessage(false);
    searchInProgressRef.current = false;
    inputRef.current?.blur();
  }

  function closeUrlPreview() {
    setShowUrlPreviewModal(false);
    setUrlSaveModalOpen(false);
  }

  return {
    // input state
    text, setText,
    searchMode,
    selectedIngredients,
    displayQuery,
    // results
    searchResults,
    webSearchResults,
    // status
    searchLoading,
    searchError,
    searchSlowMessage,
    searchModalOpen, setSearchModalOpen,
    // suggestions
    suggestions,
    showSuggestions, setShowSuggestions,
    // url import
    importingWebUrl,
    urlPreview,
    showUrlPreviewModal,
    urlSaveModalOpen, setUrlSaveModalOpen,
    urlImportPayload,
    urlDraftRecipeRow,
    urlImportCanSave,
    // computed
    hasSuggestions,
    hasSearchInputText,
    // refs
    inputRef,
    suggestionsRef,
    // handlers
    handleSearch,
    handleKeyDown,
    addIngredient,
    removeIngredient,
    changeSearchMode,
    closeSearchModalAndReset,
    importRecipeFromWebUrl,
    handleImportWebResult,
    closeUrlPreview,
  };
}
