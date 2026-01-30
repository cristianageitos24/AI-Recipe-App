"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { addRecipeToFolder, deleteFolder, getFolderRecipes, getFolders, renameFolder } from "@/app/actions/folders";
import { getFavorites } from "@/app/actions/favorites";
import { CookbookPageRecipeCard } from "@/components/CookbookPageRecipeCard";
import { processRecipeData, toRecipePayload } from "@/lib/processRecipeData";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";

type EdamamHit = { recipe: unknown };

export default function CookbookFolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderName = decodeURIComponent((params.folderName as string) ?? "");
  const [copyFolderName, setCopyFolderName] = useState(folderName);
  const [folderRecipes, setFolderRecipes] = useState<RecipeRow[]>([]);
  const [isFolderOptionsOpen, setIsFolderOptionsOpen] = useState(false);
  const [isRenameOptionOpen, setIsRenameOptionOpen] = useState(false);
  const [folderRename, setFolderRename] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [addRecipeTab, setAddRecipeTab] = useState<"your-recipes" | "search">("your-recipes");
  const [addableRecipes, setAddableRecipes] = useState<RecipeRow[]>([]);
  const [addRecipeSearchQuery, setAddRecipeSearchQuery] = useState("");
  const [addRecipeSearchResults, setAddRecipeSearchResults] = useState<EdamamHit[]>([]);
  const [addRecipeSearching, setAddRecipeSearching] = useState(false);

  const appID = process.env.NEXT_PUBLIC_EDAMAM_APP_ID;
  const appKEY = process.env.NEXT_PUBLIC_EDAMAM_APP_KEY;
  const isEdamamEnabled = Boolean(
    appID && appKEY && !appID.includes("your-") && !appKEY.includes("your-")
  );

  const refreshFolderRecipes = useCallback(() => {
    getFolderRecipes(folderName).then((res) => {
      if (res.data) setFolderRecipes(res.data);
    });
  }, [folderName]);

  useEffect(() => {
    getFolderRecipes(folderName).then((res) => {
      if (res.data) setFolderRecipes(res.data);
      setIsLoading(false);
    });
  }, [folderName]);

  useEffect(() => {
    if (!isAddRecipeModalOpen) return;
    const run = async () => {
      const [foldersRes, favoritesRes] = await Promise.all([getFolders(), getFavorites()]);
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

  function handleFolderOption(option: string) {
    if (option === "rename") setIsRenameOptionOpen(true);
    else if (option === "trash") {
      deleteFolder(copyFolderName).then((res) => {
        if (!res.error) router.push("/dashboard/cookbook");
      });
    }
    setIsFolderOptionsOpen(false);
  }

  function handleCancel() {
    setIsRenameOptionOpen(false);
  }

  async function handleConfirmFolderRename() {
    const res = await renameFolder(copyFolderName, folderRename);
    if (!res.error) {
      setIsRenameOptionOpen(false);
      setCopyFolderName(folderRename);
      router.replace(`/dashboard/cookbook/${encodeURIComponent(folderRename)}`);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleConfirmFolderRename();
  }

  function closeAddRecipeModal() {
    setIsAddRecipeModalOpen(false);
    setAddRecipeTab("your-recipes");
    setAddRecipeSearchQuery("");
    setAddRecipeSearchResults([]);
  }

  async function handleAddRecipeFromList(recipe: RecipeRow) {
    const res = await addRecipeToFolder(copyFolderName, recipe.recipe_id);
    if (!res.error) {
      refreshFolderRecipes();
      setAddableRecipes((prev) => prev.filter((r) => r.recipe_id !== recipe.recipe_id));
    }
  }

  async function handleAddRecipeSearch() {
    if (!isEdamamEnabled || !addRecipeSearchQuery.trim()) return;
    setAddRecipeSearching(true);
    try {
      const response = await fetch(
        `https://api.edamam.com/api/recipes/v2?to=10&type=public&q=${encodeURIComponent(addRecipeSearchQuery.trim())}&app_id=${appID}&app_key=${appKEY}`
      );
      if (response.ok) {
        const json = await response.json();
        setAddRecipeSearchResults(json.hits ?? []);
      } else {
        setAddRecipeSearchResults([]);
      }
    } catch {
      setAddRecipeSearchResults([]);
    } finally {
      setAddRecipeSearching(false);
    }
  }

  async function handleAddRecipeFromSearch(hit: EdamamHit) {
    const processed = processRecipeData(hit.recipe as Parameters<typeof processRecipeData>[0]);
    const payload = toRecipePayload(processed);
    const res = await addRecipeToFolder(copyFolderName, payload);
    if (!res.error) {
      refreshFolderRecipes();
      closeAddRecipeModal();
    }
  }

  return (
    <div className="right-side-panel">
      <div className="bttn-titles">
        <button type="button" className="back-bttn" onClick={() => router.push("/dashboard/cookbook")}>
          Cookbooks
        </button>
        <svg className="arrow-icon" width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L7 7L1 13" stroke="black" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <button
          type="button"
          className="folder-bttn"
          onClick={() => setIsFolderOptionsOpen(!isFolderOptionsOpen)}
          onBlur={() => setIsFolderOptionsOpen(false)}
          style={
            isFolderOptionsOpen
              ? { backgroundColor: "#D2DCE1", borderRadius: "10px 10px 0px 0px" }
              : {}
          }
        >
          {copyFolderName}
          {isFolderOptionsOpen && (
            <ul className="folder-options">
              <li onClick={() => handleFolderOption("rename")}>Rename</li>
              <hr style={{ height: "1px", background: "#C8C8C8", width: "100%", border: "none" }} />
              <li onClick={() => handleFolderOption("trash")}>Move to trash</li>
            </ul>
          )}
        </button>
        <button
          type="button"
          className="add-recipe-to-folder-btn"
          onClick={() => setIsAddRecipeModalOpen(true)}
        >
          + Add recipe
        </button>
      </div>
      {isLoading ? (
        <p className="isLoading">Loading...</p>
      ) : folderRecipes.length === 0 ? (
        <div className="empty-folder-container">
          <img className="empty-folder-pic" src="/images/emptycookbook.svg" alt="Empty folder" />
          <p className="empty-folder-subtxt">It looks like you haven&apos;t saved a recipe to your folder yet</p>
        </div>
      ) : (
        <div className="cookbook-page-recipe-cards-container">
          {folderRecipes.map((recipe) => (
            <CookbookPageRecipeCard key={recipe.id} recipeData={recipe} />
          ))}
        </div>
      )}
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
                className={`add-recipe-tab ${addRecipeTab === "search" ? "active" : ""}`}
                onClick={() => setAddRecipeTab("search")}
              >
                Search
              </button>
            </div>
            {addRecipeTab === "your-recipes" ? (
              <div className="add-recipe-list-container">
                {addableRecipes.length === 0 ? (
                  <p className="add-recipe-empty-msg">
                    Like or save recipes from Home search first, or search below.
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
                          <img
                            src={recipe.image_url ?? ""}
                            alt=""
                            className="add-recipe-list-item-img"
                          />
                          <span className="add-recipe-list-item-label">{recipe.recipe_label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="add-recipe-search-container">
                {!isEdamamEnabled ? (
                  <p className="add-recipe-empty-msg">
                    Add Edamam API keys to enable recipe search (see Home page).
                  </p>
                ) : (
                  <>
                    <div className="add-recipe-search-row">
                      <input
                        type="text"
                        className="add-recipe-search-input"
                        placeholder="Search recipes..."
                        value={addRecipeSearchQuery}
                        onChange={(e) => setAddRecipeSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddRecipeSearch()}
                      />
                      <button
                        type="button"
                        className="add-recipe-search-btn"
                        onClick={handleAddRecipeSearch}
                        disabled={addRecipeSearching}
                      >
                        {addRecipeSearching ? "Searching..." : "Search"}
                      </button>
                    </div>
                    <div className="add-recipe-search-results">
                      {addRecipeSearchResults.length === 0 && !addRecipeSearching && addRecipeSearchQuery.trim() !== "" && (
                        <p className="add-recipe-empty-msg">No results. Try another query.</p>
                      )}
                      {addRecipeSearchResults.map((hit, index) => {
                        const info = processRecipeData(hit.recipe as Parameters<typeof processRecipeData>[0]);
                        return (
                          <button
                            key={index}
                            type="button"
                            className="add-recipe-list-item add-recipe-search-result-item"
                            onClick={() => handleAddRecipeFromSearch(hit)}
                          >
                            <img src={info.imageURL} alt="" className="add-recipe-list-item-img" />
                            <span className="add-recipe-list-item-label">{info.recipeLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
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
