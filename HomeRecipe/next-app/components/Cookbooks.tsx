"use client";

import { useState, useEffect, useCallback } from "react";
import { createFolder, getFolders } from "@/app/actions/folders";
import { FolderTemplate } from "./FolderTemplate";
import "@/app/styling/Cookbooks.css";

type FolderWithLength = { folderName: string; folderLength: number };

function getFolderAndLengths(data: { folders?: string[]; results?: Record<string, unknown[]> }): FolderWithLength[] {
  const folders = data.folders ?? [];
  const results = data.results ?? {};
  return folders.map((name) => ({
    folderName: name,
    folderLength: (results[name] ?? []).length,
  }));
}

type CookbooksProps = {
  initialFoldersData?: { folders: string[]; results: Record<string, unknown[]> } | null;
};

export function Cookbooks({ initialFoldersData }: CookbooksProps = {}) {
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folders, setFolders] = useState<FolderWithLength[]>([]);

  const fetchFolders = useCallback(async () => {
    const res = await getFolders();
    if (res.data) setFolders(getFolderAndLengths(res.data));
  }, []);

  useEffect(() => {
    if (initialFoldersData !== undefined) {
      if (initialFoldersData != null) setFolders(getFolderAndLengths(initialFoldersData));
    } else {
      fetchFolders();
    }
  }, [initialFoldersData, fetchFolders]);

  function handleCancel() {
    setShowModal(false);
    setFolderName("");
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleCreateFolder();
  }

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    await createFolder(name);
    await fetchFolders();
    handleCancel();
  }

  return (
    <div className="tabcookbook-cookbooks-section">
      <h1 className="cookbook-subtitle">Personalized Cookbooks</h1>
      <div className="cookbook-folders-content-container">
        {folders.map((folder) => (
          <FolderTemplate key={folder.folderName} folderData={folder} onUpdate={fetchFolders} />
        ))}
        <button
          type="button"
          className={`add-new-folder-btn ${showModal ? "new-folder-btn-active" : ""}`}
          onClick={() => setShowModal(true)}
        >
          + Add new cookbook
        </button>
        {showModal && (
          <div
            className="new-folder-modal-overlay"
            onClick={handleCancel}
            onKeyDown={handleKeyPress}
            role="button"
            tabIndex={0}
          >
            <div className="new-folder-info-modal-content" onClick={(e) => e.stopPropagation()}>
              <h1 className="new-folder-title">New Folder</h1>
              <input
                className="new-folder-input"
                placeholder="Enter folder name"
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
              />
              <div className="modal-folder-action-btns">
                <button type="button" className="new-folder-cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="new-folder-create-btn" onClick={handleCreateFolder}>
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
