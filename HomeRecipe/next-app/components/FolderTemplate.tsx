"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useDrop } from "react-dnd";
import { addRecipeToFolder, deleteFolder, renameFolder } from "@/app/actions/folders";
import "@/app/styling/FolderTemplate.css";
import "@/app/styling/EtcButton.css";

type FolderTemplateProps = {
  folderData: { folderName: string; folderLength: number };
  onUpdate?: () => void;
};

const cookbookCovers = [
  "/images/food pictures/Recipes by Taylor Kiser.jpg",
  "/images/food pictures/Delicious Food by Sam Moghadam.jpg",
  "/images/version1/food pictures/chad-montano--GFCYhoRe48-unsplash.jpg",
  "/images/version1/food pictures/anna-tukhfatullina-food-photographer-stylist-Mzy-OjtCI70-unsplash.jpg",
  "/images/food pictures/Delicious Recipes Rirri.jpg",
];

function getCoverForFolder(folderName: string) {
  const index = [...folderName].reduce((sum, char) => sum + char.charCodeAt(0), 0) % cookbookCovers.length;
  return cookbookCovers[index];
}

function getFolderDescription(folderName: string) {
  const name = folderName.toLowerCase();
  if (name.includes("dessert") || name.includes("sweet")) return "Delicious desserts to finish perfectly.";
  if (name.includes("healthy") || name.includes("salad")) return "Nutritious recipes to fuel your day.";
  if (name.includes("week") || name.includes("quick")) return "Quick and easy recipes for busy evenings.";
  if (name.includes("comfort") || name.includes("soup")) return "Warm, comforting meals for any mood.";
  return "Favorite recipes saved for easy cooking.";
}

export function FolderTemplate({ folderData: initialFolderData, onUpdate }: FolderTemplateProps) {
  const [folderData, setFolderData] = useState(initialFolderData);
  const [isMouseHoveringTitle, setMouseHoveringTitle] = useState(false);
  const [isRenameOptionOpen, setIsRenameOptionOpen] = useState(false);
  const [copyFolderName, setCopyFolderName] = useState(folderData.folderName);
  const [folderRename, setFolderRename] = useState("");
  const [isFolderDeleted, setIsFolderDeleted] = useState(false);
  const [isEtcActive, setIsEtcActive] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [{ isHovering }, drop] = useDrop({
    accept: "RECIPE CARD",
    collect: (monitor) => ({ isHovering: monitor.isOver() }),
    drop: async (item: { id: string }) => {
      await addRecipeToFolder(copyFolderName, item.id);
      setFolderData((prev) => ({ ...prev, folderLength: prev.folderLength + 1 }));
      onUpdate?.();
    },
  });

  function handleMouseEnter() {
    timeoutRef.current = setTimeout(() => setMouseHoveringTitle(true), 500);
  }
  function handleMouseLeave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMouseHoveringTitle(false);
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") setIsRenameOptionOpen(false);
    if (e.key === "Enter") handleConfirmFolderRename();
  }

  async function handleFolderOption(option: string) {
    if (option === "Rename") setIsRenameOptionOpen(true);
    else if (option === "Move to trash") {
      const res = await deleteFolder(copyFolderName);
      if (!res.error) {
        setIsFolderDeleted(true);
        onUpdate?.();
      }
    }
    setIsEtcActive(false);
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setIsRenameOptionOpen(false);
  }

  async function handleConfirmFolderRename() {
    const res = await renameFolder(copyFolderName, folderRename);
    if (!res.error) {
      setIsRenameOptionOpen(false);
      setCopyFolderName(folderRename);
      setFolderData((prev) => ({ ...prev, folderName: folderRename }));
      onUpdate?.();
    }
  }

  return (
    <div
      className="cookbook-user-folder"
      ref={(el) => { drop(el); }}
      style={
        isFolderDeleted
          ? { display: "none" }
          : isHovering
            ? {
                backgroundColor: "var(--accent-muted-bg)",
                borderColor: "var(--accent-muted)",
                boxShadow: "0 0 0 3px var(--accent-muted)",
              }
            : undefined
      }
    >
      <div
        className="cookbook-folder-cover"
        style={{ backgroundImage: `url("${getCoverForFolder(copyFolderName)}")` }}
        aria-hidden="true"
      />
      <Link href={`/dashboard/cookbook/${encodeURIComponent(copyFolderName)}`} className="cookbook-active-content-link">
        <div className="cookbook-active-content">
          <div className="cookbook-recipe-count-bubble">
            <strong>{folderData.folderLength}</strong>
            <span>Recipes</span>
          </div>
          <p
            className="cookbook-user-foldername"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {copyFolderName}
          </p>
          {isMouseHoveringTitle && (
            <p className="cookbook-user-complete-foldername">{copyFolderName}</p>
          )}
          <p className="cookbook-folder-description">{getFolderDescription(copyFolderName)}</p>
        </div>
      </Link>
      <button
        type="button"
        className="cookbook-favorite-star"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsFavorite((prev) => !prev);
        }}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorite ? (
          <svg className="star-icon filled" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="m11.645 3.146-2.203 4.463a1.125 1.125 0 0 1-.847.615l-4.926.716a1.125 1.125 0 0 0-.624 1.918l3.564 3.474a1.125 1.125 0 0 1 .324.996l-.842 4.907a1.125 1.125 0 0 0 1.632 1.186l4.406-2.316a1.125 1.125 0 0 1 1.047 0l4.406 2.316a1.125 1.125 0 0 0 1.632-1.186l-.842-4.907a1.125 1.125 0 0 1 .324-.996l3.564-3.474a1.125 1.125 0 0 0-.624-1.918l-4.926-.716a1.125 1.125 0 0 1-.847-.615l-2.203-4.463a1.125 1.125 0 0 0-2.018 0Z" />
          </svg>
        ) : (
          <svg className="star-icon star-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11.48 3.499a.563.563 0 0 1 1.04 0l2.126 5.111a.563.563 0 0 0 .475.345l5.518.442c.5.04.704.663.323 1.034l-4.204 4.096a.563.563 0 0 0-.162.499l1.285 5.385a.562.562 0 0 1-.826.612L12.16 18.45a.563.563 0 0 0-.52 0l-4.896 2.573a.562.562 0 0 1-.826-.612l1.285-5.385a.562.562 0 0 0-.162-.499L2.837 10.43a.562.562 0 0 1 .323-1.034l5.518-.442a.563.563 0 0 0 .475-.345l2.126-5.11Z" />
          </svg>
        )}
      </button>
      <div className="etc-content">
        <button
          type="button"
          className="etc-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEtcActive(!isEtcActive);
          }}
          onBlur={() => setIsEtcActive(false)}
        >
          <svg viewBox="0 0 5 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2.201 7C1.91196 7 1.62575 7.05693 1.35871 7.16754C1.09168 7.27815 0.84904 7.44028 0.644658 7.64466C0.440277 7.84904 0.278152 8.09168 0.167541 8.35871C0.0569306 8.62575 2.27602e-07 8.91196 2.27602e-07 9.201C2.27602e-07 9.49004 0.0569306 9.77625 0.167541 10.0433C0.278152 10.3103 0.440277 10.553 0.644658 10.7573C0.84904 10.9617 1.09168 11.1238 1.35871 11.2345C1.62575 11.3451 1.91196 11.402 2.201 11.402C2.78474 11.4019 3.34452 11.1698 3.7572 10.757C4.16987 10.3441 4.40163 9.78424 4.4015 9.2005C4.40137 8.61676 4.16935 8.05698 3.75649 7.6443C3.34363 7.23163 2.78374 6.99987 2.2 7H2.201ZM2.201 4.4C2.48991 4.39987 2.77596 4.34283 3.04283 4.23215C3.30969 4.12147 3.55215 3.95931 3.75634 3.75493C3.96054 3.55055 4.12248 3.30795 4.23292 3.04098C4.34336 2.77401 4.40013 2.48791 4.4 2.199C4.39987 1.91009 4.34283 1.62404 4.23215 1.35717C4.12147 1.09031 3.95931 0.847854 3.75493 0.643658C3.55055 0.439462 3.30795 0.277522 3.04098 0.167083C2.77401 0.0566435 2.48791 -0.000131095 2.199 2.27294e-07C1.61552 0.000265452 1.05605 0.232305 0.643658 0.645072C0.231265 1.05784 -0.000264989 1.61752 2.27602e-07 2.201C0.000265444 2.78448 0.232305 3.34395 0.645072 3.75634C1.05784 4.16873 1.61752 4.40027 2.201 4.4ZM2.201 14C1.61726 14 1.05743 14.2319 0.644658 14.6447C0.231891 15.0574 2.27602e-07 15.6173 2.27602e-07 16.201C2.27602e-07 16.7847 0.231891 17.3446 0.644658 17.7573C1.05743 18.1701 1.61726 18.402 2.201 18.402C2.78474 18.402 3.34457 18.1701 3.75734 17.7573C4.17011 17.3446 4.402 16.7847 4.402 16.201C4.402 15.6173 4.17011 15.0574 3.75734 14.6447C3.34457 14.2319 2.78474 14 2.201 14Z"
              fill="currentColor"
            />
          </svg>
          {isEtcActive && (
            <ul className="etc-options">
              <li onClick={() => handleFolderOption("Rename")}>Rename</li>
              <hr
                style={{
                  height: "1px",
                  background: "var(--gray-400)",
                  border: "none",
                  width: "100%",
                }}
              />
              <li onClick={() => handleFolderOption("Move to trash")}>Move to trash</li>
            </ul>
          )}
        </button>
      </div>
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
