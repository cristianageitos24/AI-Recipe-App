"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createFolder,
  getFolders,
  addRecipeToFolder,
} from "@/app/actions/folders";
import type { RecipePayload } from "@/lib/types";

type SaveRecipeToCookbookModalProps = {
  open: boolean;
  onClose: () => void;
  payload: RecipePayload | null;
};

export function SaveRecipeToCookbookModal({
  open,
  onClose,
  payload,
}: SaveRecipeToCookbookModalProps) {
  const router = useRouter();
  const [saveFolders, setSaveFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setSaveSuccess(null);
    getFolders().then((res) => {
      if (res.data?.folders) setSaveFolders(res.data.folders as string[]);
    });
  }, [open]);

  if (!open || !payload) return null;
  const savePayload = payload;

  async function handleSaveToExistingFolder(folderName: string) {
    setSaving(true);
    setSaveError(null);
    const res = await addRecipeToFolder(folderName, savePayload);
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setSaveSuccess(`Saved to "${folderName}"`);
    const data = "data" in res ? res.data : undefined;
    setTimeout(() => {
      onClose();
      setSaveSuccess(null);
      setNewFolderName("");
      if (data?.folderName != null && data?.recipeId != null) {
        router.push(
          `/dashboard/cookbook/${encodeURIComponent(data.folderName)}?openRecipeId=${encodeURIComponent(data.recipeId)}`
        );
      }
    }, 1500);
  }

  async function handleCreateAndSave() {
    const name = newFolderName.trim();
    if (!name) {
      setSaveError("Enter a cookbook name");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const createRes = await createFolder(name);
    if (createRes.error) {
      setSaving(false);
      setSaveError(createRes.error);
      return;
    }
    const addRes = await addRecipeToFolder(name, savePayload);
    setSaving(false);
    if (addRes.error) {
      setSaveError(addRes.error);
      return;
    }
    setSaveSuccess(`Created "${name}" and saved recipe`);
    const data = "data" in addRes ? addRes.data : undefined;
    setTimeout(() => {
      onClose();
      setSaveSuccess(null);
      setNewFolderName("");
      if (data?.folderName != null && data?.recipeId != null) {
        router.push(
          `/dashboard/cookbook/${encodeURIComponent(data.folderName)}?openRecipeId=${encodeURIComponent(data.recipeId)}`
        );
      }
    }, 1500);
  }

  return (
    <div
      className="video-save-modal-overlay"
      onClick={() => !saving && onClose()}
      onKeyDown={(e) => e.key === "Escape" && !saving && onClose()}
      role="button"
      tabIndex={0}
    >
      <div
        className="video-save-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="video-save-modal-title">Save to cookbook</h3>
        {saveError && (
          <div className="error-message video-save-error">{saveError}</div>
        )}
        {saveSuccess && (
          <p className="video-save-success">{saveSuccess}</p>
        )}
        {!saveSuccess && (
          <>
            {saveFolders.length > 0 && (
              <div className="video-save-section">
                <p className="video-save-section-label">Existing cookbook</p>
                <ul className="video-save-folder-list">
                  {saveFolders.map((folder) => (
                    <li key={folder}>
                      <button
                        type="button"
                        className="video-save-folder-btn"
                        onClick={() => handleSaveToExistingFolder(folder)}
                        disabled={saving}
                      >
                        {folder}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="video-save-section">
              <p className="video-save-section-label">
                {saveFolders.length > 0 ? "Or create new cookbook" : "Create new cookbook"}
              </p>
              <div className="video-save-new-folder">
                <input
                  type="text"
                  className="form-input video-save-new-input"
                  placeholder="Cookbook name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="submit-button video-save-create-btn"
                  onClick={handleCreateAndSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Create and save"}
                </button>
              </div>
            </div>
          </>
        )}
        {!saveSuccess && (
          <button
            type="button"
            className="video-save-cancel-btn"
            onClick={() => !saving && onClose()}
            disabled={saving}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
