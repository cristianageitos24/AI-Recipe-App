"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { getVideoJob, type VideoJob } from "@/app/actions/video-jobs";
import { buildVideoRecipePayload } from "@/lib/processRecipeData";
import type { ExtractedRecipe, ExtractedRecipeIngredient } from "@/lib/types";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import { formatInstantLocal } from "@/lib/formatTimestamps";
import "@/app/styling/VideoUpload.css";

const JOB_POLL_MS = 1750;

const STAGE_LABELS: Record<string, string> = {
  downloading: "Downloading video",
  validating: "Validating clip",
  thumbnail: "Creating cover image",
  transcription: "Transcribing speech",
  ocr: "Reading on-screen text",
  reasoning: "Building your recipe",
  finalizing: "Finishing up",
  complete: "Complete",
  error: "Something went wrong",
};

function videoJobPrimaryLine(job: VideoJob): string {
  if (job.status === "uploaded" && !job.processing_stage) {
    return "Waiting in queue…";
  }
  if (job.processing_stage && STAGE_LABELS[job.processing_stage]) {
    return STAGE_LABELS[job.processing_stage];
  }
  if (job.processing_stage) {
    return job.processing_stage;
  }
  return "Processing…";
}

function formatElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoUploadFormProps {
  onJobCreated?: (jobId: string) => void;
}

type EditedRecipeState = {
  title: string;
  ingredientLines: string[];
  cookTimeMinutes: number;
  servings: number | null;
  steps: string[];
  imageUrl: string;
};

function formatIngredientLine(ing: ExtractedRecipeIngredient): string {
  const parts: string[] = [];
  if (ing.quantity != null) parts.push(String(ing.quantity));
  if (ing.unit?.trim()) parts.push(ing.unit.trim());
  parts.push(ing.item.trim());
  if (ing.notes?.trim()) parts.push(ing.notes.trim());
  return parts.join(" ");
}

function initialEditedFromExtracted(
  extracted: ExtractedRecipe,
  thumbnailUrl?: string | null
): EditedRecipeState {
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
    imageUrl: thumbnailUrl?.trim() ?? "",
  };
}

export function VideoUploadForm({ onJobCreated }: VideoUploadFormProps) {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VideoJob | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<EditedRecipeState | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ingredients" | "cooktime" | "steps">("ingredients");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);

  const inProgress =
    jobStatus?.status === "uploaded" || jobStatus?.status === "processing";

  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [inProgress, jobId]);

  const elapsedLabel = useMemo(() => {
    if (!jobStatus?.started_at || !inProgress) return null;
    const start = new Date(jobStatus.started_at).getTime();
    if (Number.isNaN(start)) return null;
    return formatElapsedMs(Date.now() - start);
  }, [jobStatus?.started_at, inProgress, elapsedTick]);

  const progressPercent = useMemo(() => {
    const raw = Number(jobStatus?.processing_progress);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [jobStatus?.processing_progress]);

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
        processing_progress: 0,
        processing_stage: null,
        processing_detail: null,
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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const pollOnce = async () => {
      const result = await getVideoJob(id, Date.now());
      if (result.error) {
        console.error("Failed to fetch job status:", result.error);
        return;
      }
      if (result.data) {
        setJobStatus(result.data);
        if (result.data.status === "done" || result.data.status === "error") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    };

    void pollOnce();
    pollIntervalRef.current = setInterval(pollOnce, JOB_POLL_MS);
  };

  // Initialize editable recipe state when job completes with extracted_recipe
  useEffect(() => {
    if (
      jobId &&
      jobStatus?.status === "done" &&
      jobStatus?.extracted_recipe
    ) {
      setEditedRecipe((prev) =>
        prev ??
        initialEditedFromExtracted(
          jobStatus!.extracted_recipe!,
          jobStatus?.thumbnail_url
        )
      );
    }
  }, [jobId, jobStatus?.status, jobStatus?.extracted_recipe, jobStatus?.thumbnail_url]);

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
    const imageUrl =
      editedRecipe.imageUrl?.trim() ||
      jobStatus?.thumbnail_url?.trim() ||
      null;
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
        imageUrl,
      }
    );
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

          {inProgress && (
            <div
              className="video-job-progress-card"
              role="status"
              aria-live="polite"
              aria-label="Video processing progress"
            >
              <div className="video-job-progress-bar-wrap">
                <div
                  className="video-job-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  aria-valuetext={`${progressPercent}% complete`}
                >
                  <div
                    className="video-job-progress-fill video-job-progress-fill--pulse"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="video-job-progress-percent" aria-hidden>
                  {progressPercent}%
                </span>
              </div>
              <p className="video-job-stage-primary">{videoJobPrimaryLine(jobStatus)}</p>
              {jobStatus.processing_detail ? (
                <p className="video-job-stage-detail">{jobStatus.processing_detail}</p>
              ) : null}
              {elapsedLabel ? (
                <>
                  <p className="video-job-elapsed">Elapsed {elapsedLabel}</p>
                  {jobStatus.started_at ? (
                    <p className="video-job-local-times">
                      Started {formatInstantLocal(jobStatus.started_at)}
                      <span className="video-job-local-times-hint"> (your local time)</span>
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}

          <div className={`status-badge status-${jobStatus.status}`}>
            {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
          </div>

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
                    <div className="form-group">
                      <label htmlFor="video-recipe-image-url">Image URL (optional)</label>
                      <input
                        id="video-recipe-image-url"
                        type="url"
                        className="form-input"
                        value={editedRecipe.imageUrl}
                        onChange={(e) =>
                          setEditedRecipe((prev) =>
                            prev ? { ...prev, imageUrl: e.target.value } : null
                          )
                        }
                        placeholder="https://... or leave blank to use video frame"
                      />
                    </div>
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

          {(jobStatus.status === "done" || jobStatus.status === "error") &&
            (jobStatus.processing_ms ||
              jobStatus.started_at ||
              jobStatus.finished_at) && (
            <div className="video-job-timing-footer">
              {jobStatus.processing_ms ? (
                <p className="processing-time">
                  Processed in {(jobStatus.processing_ms / 1000).toFixed(1)} seconds
                </p>
              ) : null}
              {(jobStatus.started_at || jobStatus.finished_at) && (
                <p className="video-job-local-times">
                  {jobStatus.started_at ? (
                    <>Started {formatInstantLocal(jobStatus.started_at)}</>
                  ) : null}
                  {jobStatus.started_at && jobStatus.finished_at ? " · " : null}
                  {jobStatus.finished_at ? (
                    <>Finished {formatInstantLocal(jobStatus.finished_at)}</>
                  ) : null}
                  <span className="video-job-local-times-hint">
                    {" "}
                    (your local time)
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <SaveRecipeToCookbookModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        payload={saveModalOpen ? getPayloadFromEdited() : null}
      />
    </div>
  );
}
