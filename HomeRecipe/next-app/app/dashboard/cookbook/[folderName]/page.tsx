"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteFolder, getFolderRecipes, renameFolder } from "@/app/actions/folders";
import { CookbookPageRecipeCard } from "@/components/CookbookPageRecipeCard";
import type { RecipeRow } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";

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

  useEffect(() => {
    getFolderRecipes(folderName).then((res) => {
      if (res.data) setFolderRecipes(res.data);
      setIsLoading(false);
    });
  }, [folderName]);

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
    </div>
  );
}
