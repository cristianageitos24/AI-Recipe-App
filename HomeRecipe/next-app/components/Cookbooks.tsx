"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [fetchedFolders, setFetchedFolders] = useState<FolderWithLength[] | null>(null);
  const folders = fetchedFolders ?? (initialFoldersData ? getFolderAndLengths(initialFoldersData) : []);

  const fetchFolders = useCallback(async () => {
    const res = await getFolders();
    if (res.data) setFetchedFolders(getFolderAndLengths(res.data));
  }, []);

  useEffect(() => {
    if (initialFoldersData !== undefined) return;

    let isCurrent = true;
    getFolders().then((res) => {
      if (isCurrent && res.data) setFetchedFolders(getFolderAndLengths(res.data));
    });

    return () => {
      isCurrent = false;
    };
  }, [initialFoldersData]);

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
      <div className="cookbook-section-header">
        <div className="cookbook-section-title-wrap">
          <h1 className="cookbook-subtitle">Your Cookbooks</h1>
          <span className="cookbook-count-badge">{folders.length}</span>
        </div>
        <button
          type="button"
          className="cookbook-header-add-btn"
          onClick={() => setShowModal(true)}
        >
          + New Cookbook
        </button>
      </div>
      <div className="cookbook-folders-content-container">
        {folders.map((folder) => (
          <FolderTemplate key={folder.folderName} folderData={folder} onUpdate={fetchFolders} />
        ))}
        <button
          type="button"
          className={`add-new-folder-btn cookbook-create-card ${showModal ? "new-folder-btn-active" : ""}`}
          onClick={() => setShowModal(true)}
        >
          <span className="cookbook-create-card-icon">+</span>
          <span>Create New Cookbook</span>
        </button>
        <AnimatePresence>
          {showModal && (
            <motion.div
              className="new-folder-modal-overlay"
              onClick={handleCancel}
              onKeyDown={handleKeyPress}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <motion.div
                className="new-folder-info-modal-content"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
