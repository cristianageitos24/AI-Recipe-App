"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createFolder } from "@/app/actions/folders";
import { invalidateCookbooksData } from "@/lib/cookbooks-cache";

type CookbookCreateCardProps = {
  onCreated?: () => void | Promise<void>;
};

export function CookbookCreateCard({ onCreated }: CookbookCreateCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  function handleCancel() {
    setShowModal(false);
    setFolderName("");
    setCreateError(null);
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") void handleCreateFolder();
  }

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    setCreateError(null);
    const res = await createFolder(name);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    invalidateCookbooksData();
    await onCreated?.();
    handleCancel();
  }

  return (
    <>
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
              {createError && (
                <p className="cookbook-create-error" role="alert">
                  {createError}
                </p>
              )}
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
    </>
  );
}
