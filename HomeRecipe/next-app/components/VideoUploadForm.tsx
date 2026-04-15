"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { getVideoJob, type VideoJob } from "@/app/actions/video-jobs";
import { buildVideoRecipePayload } from "@/lib/processRecipeData";
import type { ExtractedRecipe, ExtractedRecipeIngredient } from "@/lib/types";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import { formatInstantLocal } from "@/lib/formatTimestamps";
import "@/app/styling/VideoUpload.css";

const JOB_POLL_MS = 1750;

const STAGE_LABELS: Record<string, string> = {
  downloading: "Grabbing your clip…",
  validating: "Making sure the link looks good…",
  thumbnail: "Creating a cover image…",
  transcription: "Listening to what they say…",
  ocr: "Gathering the ingredients…",
  reasoning: "Reading through the steps…",
  finalizing: "Double-checking cooking times…",
  complete: "All set!",
  error: "Something went wrong",
};

function videoJobPrimaryLine(job: VideoJob): string {
  if (job.status === "uploaded" && !job.processing_stage) {
    return "Waiting in the queue…";
  }
  if (job.processing_stage && STAGE_LABELS[job.processing_stage]) {
    return STAGE_LABELS[job.processing_stage];
  }
  if (job.processing_stage) {
    return job.processing_stage;
  }
  return "Working on your recipe…";
}

function videoJobStageIconKey(job: VideoJob): string {
  if (job.status === "uploaded" && !job.processing_stage) return "queued";
  if (job.processing_stage && STAGE_LABELS[job.processing_stage]) {
    return job.processing_stage;
  }
  return "default";
}

function formatElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTikTokSourceLine(url: string | null): { handle: string | null; line: string } {
  if (!url?.trim()) return { handle: null, line: "" };
  const t = url.trim();
  let handle: string | null = null;
  try {
    const m = new URL(t).pathname.match(/@([^/]+)/);
    if (m) handle = `@${m[1]}`;
  } catch {
    /* ignore */
  }
  const short = t.length > 52 ? `${t.slice(0, 49)}…` : t;
  const line =
    handle != null ? `${handle} · Recipe on TikTok` : short;
  return { handle, line };
}

function buildRecipePlainText(
  edited: EditedRecipeState,
  sourceUrl: string | null
): string {
  const lines: string[] = [];
  lines.push(edited.title.trim());
  if (sourceUrl?.trim()) lines.push(`Source: ${sourceUrl.trim()}`);
  lines.push("");
  lines.push("Ingredients:");
  for (const line of edited.ingredientLines.map((l) => l.trim()).filter(Boolean)) {
    lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("Instructions:");
  edited.steps
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s, i) => {
      lines.push(`${i + 1}. ${s}`);
    });
  if (edited.cookTimeMinutes > 0) {
    lines.push("");
    lines.push(`Cook time: ${edited.cookTimeMinutes} minutes`);
  }
  if (edited.servings != null) {
    lines.push(`Servings: ${edited.servings}`);
  }
  return lines.join("\n");
}

function IconLink() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2l1.09 3.26L16 6l-2.91 1.74L12 11l-1.09-3.26L8 6l2.91-1.74L12 2zM19 11l.73 2.18L22 14l-2.27 1.36L19 18l-.73-2.18L16 14l2.27-1.36L19 11zM5 14l.91 2.73L9 18l-3.09 1.85L5 23l-.91-2.73L1 18l3.09-1.85L5 14z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChefHat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M6 13.87A4 4 0 0 1 7.41 6a4 4 0 0 1 6.93 1.5A4 4 0 0 1 18 9c0 2.22-1.8 4-4 4H6M6 17v4h12v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconForkKnife() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M8 3v9a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 3c0 2 1.5 3 2 3s2-1 2-3M8 3h4M16 3v18M16 3c0-1 1.5-2 3-2s3 1 3 2v6c0 1-1 2-3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconServings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function VideoJobStageGlyph({ stageKey }: { stageKey: string }) {
  const stroke = "currentColor";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const, "aria-hidden": true as const };
  switch (stageKey) {
    case "queued":
      return (
        <svg {...common}>
          <path d="M12 8v4l3 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "downloading":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "validating":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "thumbnail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke={stroke} strokeWidth="2" />
          <circle cx="8.5" cy="10.5" r="1.5" fill={stroke} />
          <path d="M21 17l-5-5L5 21" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "transcription":
      return (
        <svg {...common}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "ocr":
      return (
        <svg {...common}>
          <path d="M3 3h8v8H3V3zM13 3h8v4h-8V3zM13 9h8v12h-8V9zM3 13h8v8H3v-8z" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "reasoning":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "finalizing":
      return (
        <svg {...common}>
          <path d="M10 2h4M12 14v6M8 2h8l1 10H7L8 2zM5 22h14" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "error":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 13.87A4 4 0 0 1 7.41 6a4 4 0 0 1 6.93 1.5A4 4 0 0 1 18 9c0 2.22-1.8 4-4 4H6M6 17v4h12v-4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
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
    steps: extracted.steps.length > 0 ? [...extracted.steps] : [""],
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
  const [activeTab, setActiveTab] = useState<"recipe" | "nutrition">("recipe");
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const copyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);

  const inProgress =
    jobStatus?.status === "uploaded" || jobStatus?.status === "processing";

  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [inProgress, jobId]);

  useEffect(() => {
    return () => {
      if (copyHintTimer.current) clearTimeout(copyHintTimer.current);
    };
  }, []);

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

  const sourceLine = useMemo(
    () => parseTikTokSourceLine(jobStatus?.tiktok_url ?? null),
    [jobStatus?.tiktok_url]
  );

  const copyRecipe = useCallback(async () => {
    if (!editedRecipe) return;
    const text = buildRecipePlainText(
      editedRecipe,
      jobStatus?.tiktok_url ?? null
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("Copied!");
      if (copyHintTimer.current) clearTimeout(copyHintTimer.current);
      copyHintTimer.current = setTimeout(() => setCopyHint(null), 2200);
    } catch {
      setCopyHint("Could not copy");
      if (copyHintTimer.current) clearTimeout(copyHintTimer.current);
      copyHintTimer.current = setTimeout(() => setCopyHint(null), 2200);
    }
  }, [editedRecipe, jobStatus?.tiktok_url]);

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
      setActiveTab("recipe");
      setJobStatus({
        id: data.jobId,
        status: data.status,
        processing_progress: 0,
        processing_stage: null,
        processing_detail: null,
      } as VideoJob);

      startPolling(data.jobId);

      setTiktokUrl("");

      onJobCreated?.(data.jobId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "URL processing failed";
      setError(message);
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

  const submitBusy = uploading || inProgress;
  const submitLabel = submitBusy ? "Processing…" : "Cook It!";
  const stageIconKey = jobStatus ? videoJobStageIconKey(jobStatus) : "default";

  return (
    <div className="video-upload-form">
      <form onSubmit={handleSubmit} className="video-extractor-form-inner">
        <div className="video-extractor-url-row">
          <label htmlFor="tiktok-url" className="visually-hidden">
            TikTok URL
          </label>
          <div className="video-extractor-input-wrap">
            <span className="video-extractor-link-icon" aria-hidden>
              <IconLink />
            </span>
            <input
              id="tiktok-url"
              type="url"
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder="https://www.tiktok.com/..."
              className="form-input video-extractor-url-input"
              disabled={uploading}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="submit-button video-extractor-submit"
            disabled={uploading || inProgress || !tiktokUrl.trim()}
          >
            <span className="video-extractor-submit-inner">
              {submitBusy ? <IconSparkle /> : null}
              {submitLabel}
            </span>
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </form>

      {jobStatus && (
        <div className="job-status">
          {!inProgress && (
            <h3 className="job-status-heading">Status</h3>
          )}

          {inProgress && (
            <div
              className="video-job-progress-card"
              role="status"
              aria-live="polite"
              aria-label="Video processing progress"
            >
              <div className="video-job-stage-row">
                <span className="video-job-stage-icon">
                  <VideoJobStageGlyph stageKey={stageIconKey} />
                </span>
                <p className="video-job-stage-primary">
                  {videoJobPrimaryLine(jobStatus)}
                </p>
              </div>
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
              </div>
              <p className="video-job-progress-percent">
                {progressPercent}% complete
              </p>
              {jobStatus.processing_detail ? (
                <p className="video-job-stage-detail">{jobStatus.processing_detail}</p>
              ) : null}
              {elapsedLabel ? (
                <div className="video-job-meta-times">
                  <p className="video-job-elapsed">Elapsed {elapsedLabel}</p>
                  {jobStatus.started_at ? (
                    <p className="video-job-local-times">
                      Started {formatInstantLocal(jobStatus.started_at)}
                      <span className="video-job-local-times-hint">
                        {" "}
                        (your local time)
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {!inProgress && (
            <div
              className={`status-badge status-${jobStatus.status} status-badge--subtle`}
            >
              {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
            </div>
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
                  setEditedRecipe((prev) =>
                    prev ? { ...prev, title: e.target.value } : null
                  )
                }
                placeholder="Recipe name"
              />
              {jobStatus.tiktok_url ? (
                <p className="video-recipe-source" title={jobStatus.tiktok_url}>
                  <IconUser />
                  <span className="video-recipe-source-text">{sourceLine.line}</span>
                </p>
              ) : null}

              <div className="video-recipe-chips">
                <div className="video-recipe-chip">
                  <span className="video-recipe-chip-icon" aria-hidden>
                    <IconServings />
                  </span>
                  <span className="video-recipe-chip-label">Servings</span>
                  <span className="video-recipe-chip-value">
                    {editedRecipe.servings != null ? editedRecipe.servings : "—"}
                  </span>
                </div>
                <div className="video-recipe-chip">
                  <span className="video-recipe-chip-icon" aria-hidden>
                    <IconClock />
                  </span>
                  <span className="video-recipe-chip-label">Cook time</span>
                  <span className="video-recipe-chip-value">
                    {editedRecipe.cookTimeMinutes > 0
                      ? `${editedRecipe.cookTimeMinutes} min`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="video-recipe-tabs">
                <button
                  type="button"
                  className={`video-recipe-tab ${activeTab === "recipe" ? "active" : ""}`}
                  onClick={() => setActiveTab("recipe")}
                >
                  Recipe
                </button>
                <button
                  type="button"
                  className={`video-recipe-tab ${activeTab === "nutrition" ? "active" : ""}`}
                  onClick={() => setActiveTab("nutrition")}
                >
                  Nutrition
                </button>
              </div>

              <div className="video-recipe-tab-panel">
                {activeTab === "recipe" && (
                  <div className="video-recipe-split">
                    <div className="video-recipe-ingredients">
                      <h4 className="video-recipe-column-title">
                        <IconChefHat />
                        Ingredients
                      </h4>
                      {editedRecipe.ingredientLines.map((line, i) => (
                        <div key={i} className="video-recipe-line-row">
                          <span className="video-recipe-ingredient-bullet" aria-hidden />
                          <input
                            type="text"
                            className="form-input video-recipe-line-input"
                            value={line}
                            onChange={(e) => {
                              const next = [...editedRecipe.ingredientLines];
                              next[i] = e.target.value;
                              setEditedRecipe((prev) =>
                                prev ? { ...prev, ingredientLines: next } : null
                              );
                            }}
                            placeholder="Ingredient"
                          />
                          <button
                            type="button"
                            className="video-recipe-remove-btn"
                            onClick={() => {
                              const next = editedRecipe.ingredientLines.filter(
                                (_, idx) => idx !== i
                              );
                              if (next.length === 0) next.push("");
                              setEditedRecipe((prev) =>
                                prev ? { ...prev, ingredientLines: next } : null
                              );
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
                            prev
                              ? { ...prev, ingredientLines: [...prev.ingredientLines, ""] }
                              : null
                          )
                        }
                      >
                        + Add ingredient
                      </button>
                    </div>
                    <div className="video-recipe-steps">
                      <h4 className="video-recipe-column-title">
                        <IconForkKnife />
                        Instructions
                      </h4>
                      {editedRecipe.steps.map((step, i) => (
                        <div key={i} className="video-recipe-step-row">
                          <span className="video-recipe-step-num">{i + 1}</span>
                          <textarea
                            className="form-input video-recipe-step-input"
                            value={step}
                            onChange={(e) => {
                              const next = [...editedRecipe.steps];
                              next[i] = e.target.value;
                              setEditedRecipe((prev) =>
                                prev ? { ...prev, steps: next } : null
                              );
                            }}
                            placeholder="Step"
                            rows={3}
                          />
                          <button
                            type="button"
                            className="video-recipe-remove-btn"
                            onClick={() => {
                              const next = editedRecipe.steps.filter((_, idx) => idx !== i);
                              if (next.length === 0) next.push("");
                              setEditedRecipe((prev) =>
                                prev ? { ...prev, steps: next } : null
                              );
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
                  </div>
                )}

                {activeTab === "nutrition" && (
                  <div className="video-recipe-cooktime">
                    <p className="video-recipe-nutrition-note">
                      Full nutrition facts (calories, macros) are not extracted from video yet.
                      You can adjust servings and timing here before saving.
                    </p>
                    <div className="form-group">
                      <label htmlFor="video-recipe-servings">Servings (optional)</label>
                      <input
                        id="video-recipe-servings"
                        type="number"
                        min={1}
                        className="form-input"
                        value={editedRecipe.servings ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setEditedRecipe((prev) => {
                            if (!prev) return null;
                            if (raw === "") return { ...prev, servings: null };
                            const n = parseInt(raw, 10);
                            if (!Number.isFinite(n) || n < 1) return prev;
                            return { ...prev, servings: n };
                          });
                        }}
                        placeholder="e.g. 4"
                      />
                    </div>
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
                            prev
                              ? {
                                  ...prev,
                                  cookTimeMinutes: Number.isFinite(v) ? v : 0,
                                }
                              : null
                          );
                        }}
                        placeholder="Not specified"
                      />
                    </div>
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
              </div>

              <div className="video-recipe-actions-row">
                <button
                  type="button"
                  className="video-recipe-copy-btn"
                  onClick={() => void copyRecipe()}
                >
                  Copy recipe
                </button>
                {copyHint ? (
                  <span className="video-recipe-copy-hint" role="status">
                    {copyHint}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="submit-button video-recipe-save-btn"
                  onClick={() => setSaveModalOpen(true)}
                >
                  Save to cookbook
                </button>
              </div>
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
