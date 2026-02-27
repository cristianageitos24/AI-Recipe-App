"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getVideoJob, type VideoJob } from "@/app/actions/video-jobs";
import {
  createFolder,
  getFolders,
  addRecipeToFolder,
} from "@/app/actions/folders";
import { buildVideoRecipePayload } from "@/lib/processRecipeData";
import type { ExtractedRecipe, ExtractedRecipeIngredient } from "@/lib/types";

interface VideoUploadFormProps {
  onJobCreated?: (jobId: string) => void;
}

type EditedRecipeState = {
  title: string;
  ingredientLines: string[];
  cookTimeMinutes: number;
  servings: number | null;
  steps: string[];
};

function formatIngredientLine(ing: ExtractedRecipeIngredient): string {
  const parts: string[] = [];
  if (ing.quantity != null) parts.push(String(ing.quantity));
  if (ing.unit?.trim()) parts.push(ing.unit.trim());
  parts.push(ing.item.trim());
  if (ing.notes?.trim()) parts.push(ing.notes.trim());
  return parts.join(" ");
}

function initialEditedFromExtracted(extracted: ExtractedRecipe): EditedRecipeState {
  return {
    title: extracted.title.trim() || "Untitled Recipe",
    ingredientLines:
      extracted.ingredients.length > 0
        ? extracted.ingredients.map(formatIngredientLine)
        : [""],
    cookTimeMinutes: extracted.cook_time_minutes ?? 0,
    servings: extracted.servings ?? null,
    steps:
      extracted.steps.length > 0
        ? [...extracted.steps]
        : [""],
  };
}

export function VideoUploadForm({ onJobCreated }: VideoUploadFormProps) {
  const router = useRouter();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VideoJob | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<EditedRecipeState | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ingredients" | "cooktime" | "steps">("ingredients");
  const [saveFolders, setSaveFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = tiktokUrl.trim();
    if (!trimmedUrl) {
      setError("Please enter a TikTok URL");
      return;
    }

    try {
      const url = new URL(trimmedUrl);
      if (!/^https?:$/.test(url.protocol) || !url.hostname.includes("tiktok.com")) {
        setError("Please enter a valid TikTok URL");
        return;
      }
    } catch {
      setError("Please enter a valid TikTok URL");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fetch("/api/video/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data.detail
          ? `${data.error}: ${data.detail}`
          : data.error || "Upload failed";
        throw new Error(message);
      }

      setJobId(data.jobId);
      setEditedRecipe(null);
      setJobStatus({
        id: data.jobId,
        status: data.status,
      } as VideoJob);

      // Start polling for status
      startPolling(data.jobId);

      // Reset form
      setTiktokUrl("");

      onJobCreated?.(data.jobId);
    } catch (err: any) {
      setError(err.message || "URL processing failed");
    } finally {
      setUploading(false);
    }
  };

  const startPolling = (id: string) => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const result = await getVideoJob(id);
      if (result.error) {
        console.error("Failed to fetch job status:", result.error);
        return;
      }

      if (result.data) {
        setJobStatus(result.data);

        // Stop polling if job is done or error
        if (result.data.status === "done" || result.data.status === "error") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    }, 2000);
  };

  // Initialize editable recipe state when job completes with extracted_recipe
  useEffect(() => {
    if (
      jobId &&
      jobStatus?.status === "done" &&
      jobStatus?.extracted_recipe
    ) {
      setEditedRecipe((prev) => prev ?? initialEditedFromExtracted(jobStatus.extracted_recipe!));
    }
  }, [jobId, jobStatus?.status, jobStatus?.extracted_recipe]);

  // Fetch folders when save modal opens
  useEffect(() => {
    if (saveModalOpen) {
      setSaveError(null);
      setSaveSuccess(null);
      getFolders().then((res) => {
        if (res.data?.folders) setSaveFolders(res.data.folders as string[]);
      });
    }
  }, [saveModalOpen]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  function getPayloadFromEdited() {
    if (!jobId || !editedRecipe) return null;
    return buildVideoRecipePayload(
      {
        title: editedRecipe.title,
        ingredientLines: editedRecipe.ingredientLines,
        cookTimeMinutes: editedRecipe.cookTimeMinutes,
        steps: editedRecipe.steps,
      },
      jobId,
      {
        sourceUrl: jobStatus?.tiktok_url ?? null,
      }
    );
  }

  async function handleSaveToExistingFolder(folderName: string) {
    const payload = getPayloadFromEdited();
    if (!payload) return;
    setSaving(true);
    setSaveError(null);
    const res = await addRecipeToFolder(folderName, payload);
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setSaveSuccess(`Saved to "${folderName}"`);
    const data = "data" in res ? res.data : undefined;
    setTimeout(() => {
      setSaveModalOpen(false);
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
    const payload = getPayloadFromEdited();
    if (!payload) return;
    setSaving(true);
    setSaveError(null);
    const createRes = await createFolder(name);
    if (createRes.error) {
      setSaving(false);
      setSaveError(createRes.error);
      return;
    }
    const addRes = await addRecipeToFolder(name, payload);
    setSaving(false);
    if (addRes.error) {
      setSaveError(addRes.error);
      return;
    }
    setSaveSuccess(`Created "${name}" and saved recipe`);
    const data = "data" in addRes ? addRes.data : undefined;
    setTimeout(() => {
      setSaveModalOpen(false);
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
    <div className="video-upload-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tiktok-url">TikTok URL</label>
          <input
            id="tiktok-url"
            type="url"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://www.tiktok.com/..."
            className="form-input"
            disabled={uploading}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-button"
          disabled={uploading || !tiktokUrl.trim()}
        >
          {uploading ? "Processing..." : "Extract recipe from TikTok"}
        </button>
      </form>

      {jobStatus && (
        <div className="job-status">
          <h3>Processing Status</h3>
          <div className={`status-badge status-${jobStatus.status}`}>
            {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
          </div>

          {jobStatus.status === "processing" && (
            <p className="status-message">
              Processing video... This may take a few minutes.
            </p>
          )}

          {jobStatus.status === "done" && editedRecipe && (
            <div className="video-recipe-editor">
              <label htmlFor="video-recipe-title" className="video-recipe-editor-label">
                Recipe name
              </label>
              <input
                id="video-recipe-title"
                type="text"
                className="form-input video-recipe-title-input"
                value={editedRecipe.title}
                onChange={(e) =>
                  setEditedRecipe((prev) => prev ? { ...prev, title: e.target.value } : null)
                }
                placeholder="Recipe name"
              />
              <div className="video-recipe-tabs">
                <button
                  type="button"
                  className={`video-recipe-tab ${activeTab === "ingredients" ? "active" : ""}`}
                  onClick={() => setActiveTab("ingredients")}
                >
                  Ingredients
                </button>
                <button
                  type="button"
                  className={`video-recipe-tab ${activeTab === "cooktime" ? "active" : ""}`}
                  onClick={() => setActiveTab("cooktime")}
                >
                  Cook time
                </button>
                <button
                  type="button"
                  className={`video-recipe-tab ${activeTab === "steps" ? "active" : ""}`}
                  onClick={() => setActiveTab("steps")}
                >
                  Steps
                </button>
              </div>
              <div className="video-recipe-tab-panel">
                {activeTab === "ingredients" && (
                  <div className="video-recipe-ingredients">
                    {editedRecipe.ingredientLines.map((line, i) => (
                      <div key={i} className="video-recipe-line-row">
                        <input
                          type="text"
                          className="form-input video-recipe-line-input"
                          value={line}
                          onChange={(e) => {
                            const next = [...editedRecipe.ingredientLines];
                            next[i] = e.target.value;
                            setEditedRecipe((prev) => prev ? { ...prev, ingredientLines: next } : null);
                          }}
                          placeholder="Ingredient"
                        />
                        <button
                          type="button"
                          className="video-recipe-remove-btn"
                          onClick={() => {
                            const next = editedRecipe.ingredientLines.filter((_, idx) => idx !== i);
                            if (next.length === 0) next.push("");
                            setEditedRecipe((prev) => prev ? { ...prev, ingredientLines: next } : null);
                          }}
                          aria-label="Remove ingredient"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="video-recipe-add-btn"
                      onClick={() =>
                        setEditedRecipe((prev) =>
                          prev ? { ...prev, ingredientLines: [...prev.ingredientLines, ""] } : null
                        )
                      }
                    >
                      + Add ingredient
                    </button>
                  </div>
                )}
                {activeTab === "cooktime" && (
                  <div className="video-recipe-cooktime">
                    <div className="form-group">
                      <label htmlFor="video-recipe-cook-time">Cook time (minutes)</label>
                      <input
                        id="video-recipe-cook-time"
                        type="number"
                        min={0}
                        className="form-input"
                        value={editedRecipe.cookTimeMinutes || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setEditedRecipe((prev) =>
                            prev ? { ...prev, cookTimeMinutes: Number.isFinite(v) ? v : 0 } : null
                          );
                        }}
                        placeholder="Not specified"
                      />
                    </div>
                    {editedRecipe.servings != null && (
                      <div className="form-group">
                        <label>Servings</label>
                        <p className="video-recipe-servings-display">{editedRecipe.servings}</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "steps" && (
                  <div className="video-recipe-steps">
                    {editedRecipe.steps.map((step, i) => (
                      <div key={i} className="video-recipe-step-row">
                        <span className="video-recipe-step-num">{i + 1}.</span>
                        <textarea
                          className="form-input video-recipe-step-input"
                          value={step}
                          onChange={(e) => {
                            const next = [...editedRecipe.steps];
                            next[i] = e.target.value;
                            setEditedRecipe((prev) => prev ? { ...prev, steps: next } : null);
                          }}
                          placeholder="Step"
                          rows={2}
                        />
                        <button
                          type="button"
                          className="video-recipe-remove-btn"
                          onClick={() => {
                            const next = editedRecipe.steps.filter((_, idx) => idx !== i);
                            if (next.length === 0) next.push("");
                            setEditedRecipe((prev) => prev ? { ...prev, steps: next } : null);
                          }}
                          aria-label="Remove step"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="video-recipe-add-btn"
                      onClick={() =>
                        setEditedRecipe((prev) =>
                          prev ? { ...prev, steps: [...prev.steps, ""] } : null
                        )
                      }
                    >
                      + Add step
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="submit-button video-recipe-save-btn"
                onClick={() => setSaveModalOpen(true)}
              >
                Save to cookbook
              </button>
            </div>
          )}

          {jobStatus.status === "done" && !jobStatus.extracted_recipe && (
            <>
              <p className="status-message">
                We couldn&apos;t extract a structured recipe; you can still copy the text below.
              </p>
              {jobStatus.ocr_text && (
                <div className="ocr-result">
                  <h4>Extracted Text (OCR):</h4>
                  <pre className="ocr-text">{jobStatus.ocr_text}</pre>
                </div>
              )}
              {jobStatus.transcript_text && (
                <div className="ocr-result">
                  <h4>Speech-to-Text (Whisper):</h4>
                  <pre className="ocr-text">{jobStatus.transcript_text}</pre>
                </div>
              )}
            </>
          )}

          {jobStatus.status === "done" && jobStatus.extracted_recipe && !editedRecipe && (
            <p className="status-message">Loading recipe...</p>
          )}

          {jobStatus.status === "error" && jobStatus.error_message && (
            <div className="error-message">
              <strong>Error:</strong> {jobStatus.error_message}
            </div>
          )}

          {jobStatus.processing_ms && (
            <p className="processing-time">
              Processed in {(jobStatus.processing_ms / 1000).toFixed(1)} seconds
            </p>
          )}
        </div>
      )}

      {saveModalOpen && (
        <div
          className="video-save-modal-overlay"
          onClick={() => !saving && setSaveModalOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && !saving && setSaveModalOpen(false)}
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
                onClick={() => !saving && setSaveModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
