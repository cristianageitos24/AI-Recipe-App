"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HeartButton } from "@/components/HeartButton";
import { SaveToFolderButton } from "@/components/SaveToFolderButton";
import { processRecipeData, type ProcessedRecipe } from "@/lib/processRecipeData";
import { getFolders } from "@/app/actions/folders";
import { getFavorites } from "@/app/actions/favorites";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/TabHome.css";

function capitalizeFirstLetter(string: string): string {
  if (string.includes("/")) {
    string = string.replace(/\/(.)/g, (_, char: string) => `/${char.toUpperCase()}`);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function recipeRowToProcessed(r: RecipeRow): ProcessedRecipe {
  return {
    recipeID: r.recipe_id,
    recipeLabel: r.recipe_label,
    calories: r.calories,
    cuisineType: r.cuisine_type ?? "",
    mealType: r.meal_type ?? "",
    timeMin: r.time_in_minutes,
    ingredients: r.ingredient_lines ?? "",
    imageURL: r.image_url ?? "",
    websiteURL: r.website_url ?? "",
  };
}

type EdamamHit = { recipe: unknown };

type FolderWithCount = { folderName: string; count: number };

export default function DashboardHomePage() {
  const [text, setText] = useState("");
  const [displayTxt, setDisplayTxt] = useState("");
  const [data, setData] = useState<{ hits?: EdamamHit[] } | null>(null);
  const [folderOptions, setFolderOptions] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<RecipeRow[]>([]);
  const [foldersWithCounts, setFoldersWithCounts] = useState<FolderWithCount[]>([]);
  const [recommendedHits, setRecommendedHits] = useState<EdamamHit[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  const appID = process.env.NEXT_PUBLIC_EDAMAM_APP_ID;
  const appKEY = process.env.NEXT_PUBLIC_EDAMAM_APP_KEY;
  const isEdamamEnabled = Boolean(
    appID && appKEY && !appID.includes("your-") && !appKEY.includes("your-")
  );
  const numberOfRecipes = 20;

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
    if (!isEdamamEnabled) return;
    setRecommendedLoading(true);
    Promise.all([getFavorites(), getFolders()])
      .then(([favRes, foldRes]) => {
        const savedIds = new Set<string>();
        (favRes.data ?? []).forEach((r: RecipeRow) => savedIds.add(r.recipe_id));
        const results = (foldRes.data?.results ?? {}) as Record<string, RecipeRow[]>;
        (foldRes.data?.folders ?? []).forEach((name: string) => {
          (results[name] ?? []).forEach((r: RecipeRow) => savedIds.add(r.recipe_id));
        });
        return fetch(
          `https://api.edamam.com/api/recipes/v2?to=20&type=public&q=popular+recipes&app_id=${appID}&app_key=${appKEY}`
        )
          .then((response) => (response.ok ? response.json() : { hits: [] }))
          .then((json) => {
            let hits = json.hits ?? [];
            if (savedIds.size > 0) {
              hits = hits.filter((hit: EdamamHit) => {
                const info = processRecipeData(hit.recipe as Parameters<typeof processRecipeData>[0]);
                return !savedIds.has(info.recipeID);
              });
            }
            setRecommendedHits(hits.slice(0, 12));
          });
      })
      .catch(() => setRecommendedHits([]))
      .finally(() => setRecommendedLoading(false));
  }, [isEdamamEnabled, appID, appKEY]);

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter") fetchData();
  }

  async function fetchData() {
    if (!isEdamamEnabled) return;
    try {
      const response = await fetch(
        `https://api.edamam.com/api/recipes/v2?to=${numberOfRecipes}&type=public&q=${encodeURIComponent(text)}&app_id=${appID}&app_key=${appKEY}`
      );
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setDisplayTxt(text);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function RecipeCard({ recipeData }: { recipeData: unknown }) {
    const information = processRecipeData(recipeData as Parameters<typeof processRecipeData>[0]);

    return (
      <div className="results-content">
        <img
          className="result-pic"
          src={information.imageURL}
          alt={information.recipeLabel}
        />
        <div className="results-labels">
          <h1>{information.recipeLabel}</h1>
          <div className="label-details">
            <h3>{capitalizeFirstLetter(information.cuisineType)}</h3>
            <h3>{capitalizeFirstLetter(information.mealType)}</h3>
          </div>
          <div className="label-details">
            <h3>{information.calories} calories</h3>
            {information.timeMin < 1 ? (
              <h3 className="green-light">1 minute</h3>
            ) : information.timeMin <= 10 ? (
              <h3 className="green-light">{information.timeMin} minutes</h3>
            ) : information.timeMin > 10 && information.timeMin <= 30 ? (
              <h3 className="yellow-light">{information.timeMin} minutes</h3>
            ) : (
              <h3 className="red-light">{information.timeMin} minutes</h3>
            )}
          </div>
        </div>
        <div className="result-buttons">
          <button
            type="button"
            className="open-recipe-link-btn"
            onClick={() => window.open(information.websiteURL, "_blank")}
          >
            Show Recipe
          </button>
          <div className="save-folder-btns">
            <div className="heart-btn-search-results-card">
              <HeartButton recipeData={information} heartStyle={{ top: "50%" }} />
            </div>
            <SaveToFolderButton
              folders={[...new Set(folderOptions)]}
              recipeData={information}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="right-side-panel">
      <div className="recipe-search-content">
        <div className="search-container">
          <input
            type="text"
            placeholder={isEdamamEnabled ? "Search recipes!" : "Recipe search disabled"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="search-txt"
            onKeyDown={handleKeyPress}
            autoFocus={isEdamamEnabled}
            disabled={!isEdamamEnabled}
          />
          <button
            type="button"
            className="search-btn"
            onClick={fetchData}
            disabled={!isEdamamEnabled}
            title={!isEdamamEnabled ? "Add Edamam API keys to enable" : "Search"}
          >
            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.71 16.29L14.31 12.9C15.407 11.5025 16.0022 9.77666 16 8C16 6.41775 15.5308 4.87103 14.6518 3.55544C13.7727 2.23985 12.5233 1.21447 11.0615 0.608967C9.59966 0.00346625 7.99113 -0.15496 6.43928 0.153721C4.88743 0.462403 3.46197 1.22433 2.34315 2.34315C1.22433 3.46197 0.462403 4.88743 0.153721 6.43928C-0.15496 7.99113 0.00346625 9.59966 0.608967 11.0615C1.21447 12.5233 2.23985 13.7727 3.55544 14.6518C4.87103 15.5308 6.41775 16 8 16C9.77666 16.0022 11.5025 15.407 12.9 14.31L16.29 17.71C16.383 17.8037 16.4936 17.8781 16.6154 17.9289C16.7373 17.9797 16.868 18.0058 17 18.0058C17.132 18.0058 17.2627 17.9797 17.3846 17.9289C17.5064 17.8781 17.617 17.8037 17.71 17.71C17.8037 17.617 17.8781 17.5064 17.9289 17.3846C17.9797 17.2627 18.0058 17.132 18.0058 17C18.0058 16.868 17.9797 16.7373 17.9289 16.6154C17.8781 16.4936 17.8037 16.383 17.71 16.29ZM2 8C2 6.81332 2.3519 5.65328 3.01119 4.66658C3.67047 3.67989 4.60755 2.91085 5.7039 2.45673C6.80026 2.0026 8.00666 1.88378 9.17055 2.11529C10.3344 2.3468 11.4035 2.91825 12.2426 3.75736C13.0818 4.59648 13.6532 5.66558 13.8847 6.82946C14.1162 7.99335 13.9974 9.19975 13.5433 10.2961C13.0892 11.3925 12.3201 12.3295 11.3334 12.9888C10.3467 13.6481 9.18669 14 8 14C6.4087 14 4.88258 13.3679 3.75736 12.2426C2.63214 11.1174 2 9.5913 2 8Z"
                fill="black"
              />
            </svg>
          </button>
        </div>
        {!isEdamamEnabled && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <h2 className="mb-2 text-lg font-medium">Recipe Search</h2>
            <p className="mb-4 text-sm text-gray-600">
              Add your Edamam API keys to enable recipe search. Create a free account at{" "}
              <a
                href="https://developer.edamam.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                developer.edamam.com
              </a>
              .
            </p>
            <p className="text-xs text-gray-500">
              Set NEXT_PUBLIC_EDAMAM_APP_ID and NEXT_PUBLIC_EDAMAM_APP_KEY in .env.local
            </p>
          </div>
        )}
        {isEdamamEnabled && data?.hits && (
          <div>
            <h1 className="search-looking">
              Searched: <span>{displayTxt}</span>
            </h1>
            <div className="data-content">
              {data.hits.map((item, index) => (
                <motion.div key={index} whileHover={{ scale: 1.02 }}>
                  <RecipeCard recipeData={item.recipe} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
        {favorites.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">Favorites</h2>
            <div className="home-section-scroll">
              {favorites.map((recipe) => {
                const info = recipeRowToProcessed(recipe);
                return (
                  <motion.div key={recipe.id} className="home-card results-content" whileHover={{ scale: 1.02 }}>
                    {recipe.image_url ? (
                      <img className="result-pic" src={recipe.image_url} alt={recipe.recipe_label} />
                    ) : (
                      <span className="result-pic result-pic-placeholder" aria-hidden />
                    )}
                    <div className="results-labels">
                      <h1>{recipe.recipe_label}</h1>
                      <div className="label-details">
                        <h3>{capitalizeFirstLetter(recipe.cuisine_type ?? "")}</h3>
                        <h3>{capitalizeFirstLetter(recipe.meal_type ?? "")}</h3>
                      </div>
                      <div className="label-details">
                        <h3>{recipe.calories} calories</h3>
                        <h3 className={recipe.time_in_minutes <= 10 ? "green-light" : recipe.time_in_minutes <= 30 ? "yellow-light" : "red-light"}>
                          {recipe.time_in_minutes < 1 ? "1" : recipe.time_in_minutes} min
                        </h3>
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
                          <HeartButton recipeData={info} heartStyle={{ top: "50%" }} isHearted />
                        </div>
                        <SaveToFolderButton folders={[...new Set(folderOptions)]} recipeData={info} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
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
                  <span className="home-cookbook-count">{f.count} recipe{f.count !== 1 ? "s" : ""}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {isEdamamEnabled && (
          <section className="home-section">
            <h2 className="home-section-title">Recommended for you</h2>
            {recommendedLoading ? (
              <p className="home-section-loading">Loading recommendations...</p>
            ) : recommendedHits.length > 0 ? (
              <div className="home-section-scroll">
                {recommendedHits.map((item, index) => (
                  <motion.div key={index} whileHover={{ scale: 1.02 }}>
                    <RecipeCard recipeData={item.recipe} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="home-section-empty">Search for recipes above to get personalized recommendations.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
