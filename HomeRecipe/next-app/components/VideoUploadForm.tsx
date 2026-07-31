"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getVideoJob, type VideoJob } from "@/app/actions/video-jobs";
import { addGroceryItem, addGroceryItems } from "@/app/actions/grocery-items";
import {
  buildVideoRecipePayload,
  formatExtractedIngredientLine,
  videoExtractionToDraftRecipeRow,
} from "@/lib/processRecipeData";
import { recipeNutritionSourceDetail } from "@/lib/nutrition/nutrition-display";
import { buildRecipeTemplateData, splitIngredientLineForTemplate } from "@/lib/recipe-template";
import type { ExtractedRecipe } from "@/lib/types";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import { RecipeTemplateShell } from "@/components/RecipeTemplateShell";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useEntitlements } from "@/components/EntitlementsProvider";
import { formatInstantLocal } from "@/lib/formatTimestamps";
import { classifyUrlForIngest } from "@/lib/url-ingest-classification";
import "@/app/styling/VideoUpload.css";
import "@/app/styling/RecipeTemplateShell.css";
import "@/app/styling/RecipeFullView.css";

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

function mergeIngredientParts(qty: string, name: string): string {
  const q = qty.trim();
  const n = name.trim();
  if (!q) return n;
  if (!n) return q;
  return `${q} ${n}`;
}

function macroGDisplay(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toFixed(0)}g`;
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

function AddToGroceryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="10" y1="10" x2="14" y2="10" />
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
  variant?: "default" | "embedded" | "embedded-unified";
  /**
   * When `variant` is `embedded-unified`, non-video URLs trigger this handler (recipe webpage import).
   */
  onWebRecipeUrlImport?: (url: string) => Promise<void>;
  /** Free remaining extractions; null = Pro/unlimited. */
  extractionsRemaining?: number | null;
  onExtractionBlocked?: () => void;
  onExtractSuccess?: () => void;
}

type EditedRecipeState = {
  title: string;
  ingredientLines: string[];
  cookTimeMinutes: number;
  servings: number | null;
  steps: string[];
  imageUrl: string;
};

function initialEditedFromExtracted(
  extracted: ExtractedRecipe,
  thumbnailUrl?: string | null
): EditedRecipeState {
  return {
    title: extracted.title.trim() || "Untitled Recipe",
    ingredientLines:
      extracted.ingredients.length > 0
        ? extracted.ingredients.map(formatExtractedIngredientLine)
        : [""],
    cookTimeMinutes: extracted.cook_time_minutes ?? 0,
    servings: extracted.servings ?? null,
    steps: extracted.steps.length > 0 ? [...extracted.steps] : [""],
    imageUrl: thumbnailUrl?.trim() ?? "",
  };
}

export function VideoUploadForm({
  onJobCreated,
  variant = "default",
  onWebRecipeUrlImport,
  extractionsRemaining = null,
  onExtractionBlocked,
  onExtractSuccess,
}: VideoUploadFormProps) {
  const { entitlements } = useEntitlements();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [webImportInFlight, setWebImportInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VideoJob | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<EditedRecipeState | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [groceryFeedback, setGroceryFeedback] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<"planning" | "nutrition" | null>(null);
  const [addAllBusy, setAddAllBusy] = useState(false);
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

  const extractedNutritionEmbedded = useMemo(() => {
    const ex = jobStatus?.extracted_recipe;
    if (!ex?.recipe_nutrition || !editedRecipe) return null;
    const baseLines = ex.ingredients.map((ing) => formatExtractedIngredientLine(ing));
    const editedLines = editedRecipe.ingredientLines.map((s) => s.trim()).filter(Boolean);
    if (baseLines.length !== editedLines.length) return null;
    for (let i = 0; i < baseLines.length; i++) {
      if (baseLines[i] !== editedLines[i]) return null;
    }
    return {
      recipe_nutrition: ex.recipe_nutrition,
      recipe_ingredient_lines: ex.recipe_ingredient_lines ?? null,
    };
  }, [jobStatus?.extracted_recipe, editedRecipe]);

  const draftRecipeRow = useMemo(
    () =>
      jobId && editedRecipe
        ? videoExtractionToDraftRecipeRow(
            editedRecipe,
            jobId,
            {
              sourceUrl: jobStatus?.tiktok_url ?? null,
              thumbnailUrl: jobStatus?.thumbnail_url ?? null,
            },
            extractedNutritionEmbedded
          )
        : null,
    [
      jobId,
      editedRecipe,
      jobStatus?.tiktok_url,
      jobStatus?.thumbnail_url,
      extractedNutritionEmbedded,
    ]
  );

  const recipeTemplate = useMemo(
    () => (draftRecipeRow ? buildRecipeTemplateData(draftRecipeRow) : null),
    [draftRecipeRow]
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

  const handleAddIngredient = useCallback(async (item: string) => {
    if (!entitlements.isPro) {
      setUpgradeReason("planning");
      return;
    }
    const res = await addGroceryItem(item);
    if (res.error) {
      setGroceryFeedback(res.error);
    } else if (res.duplicate) {
      setGroceryFeedback("Already in list");
    } else {
      setGroceryFeedback("Added");
    }
    setTimeout(() => setGroceryFeedback(null), 2000);
  }, [entitlements.isPro]);

  const handleAddAllIngredients = useCallback(async () => {
    if (!entitlements.isPro) {
      setUpgradeReason("planning");
      return;
    }
    if (!editedRecipe || addAllBusy) return;
    const lines = editedRecipe.ingredientLines.map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAddAllBusy(true);
    const res = await addGroceryItems(lines);
    if (res.error) {
      setGroceryFeedback(res.error);
    } else if (res.added === 0 && res.skipped > 0) {
      setGroceryFeedback("All already in list");
    } else if (res.added > 0) {
      setGroceryFeedback(null);
    }
    setAddAllBusy(false);
    setTimeout(() => setGroceryFeedback(null), 2000);
  }, [editedRecipe, addAllBusy, entitlements.isPro]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (extractionsRemaining === 0) {
      onExtractionBlocked?.();
      setError("You've used your free extractions this month.");
      return;
    }

    const trimmedUrl = tiktokUrl.trim();
    if (!trimmedUrl) {
      setError(
        variant === "embedded-unified" ? "Please enter a URL" : "Please enter a TikTok URL"
      );
      return;
    }

    if (variant === "embedded-unified") {
      const classified = classifyUrlForIngest(trimmedUrl);
      if (classified.kind === "invalid") {
        setError(classified.error);
        return;
      }
      if (classified.kind === "webpage") {
        if (!onWebRecipeUrlImport) {
          setError("Recipe URL import is not available.");
          return;
        }
        setWebImportInFlight(true);
        setError(null);
        try {
          await onWebRecipeUrlImport(trimmedUrl);
          setTiktokUrl("");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Import failed";
          setError(message);
        } finally {
          setWebImportInFlight(false);
        }
        return;
      }
      // Video URL (currently TikTok only for supported platforms)
    } else {
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
        if (response.status === 403 && data.code === "PLAN_LIMIT") {
          onExtractionBlocked?.();
        }
        const message = data.detail
          ? `${data.error}: ${data.detail}`
          : data.error || "Upload failed";
        throw new Error(message);
      }

      setJobId(data.jobId);
      setEditedRecipe(null);
      onExtractSuccess?.();
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

  const submitBusy = uploading || inProgress || webImportInFlight;
  const stageIconKey = jobStatus ? videoJobStageIconKey(jobStatus) : "default";
  const reduceMotion = useReducedMotion();
  const homeMotionEnabled =
    (variant === "embedded" || variant === "embedded-unified") && !reduceMotion;
  const layoutTransition = { duration: 0.22, ease: "easeOut" as const };
  const nutritionSource = recipeTemplate?.nutrition.nutritionSource ?? "incomplete";
  const nutritionSourceLabel =
    nutritionSource === "fdc"
      ? "USDA"
      : nutritionSource === "estimated"
        ? "Estimated"
        : nutritionSource === "mixed"
          ? "Mixed"
          : "Incomplete";

  return (
    <motion.div
      className={`video-upload-form${
        variant === "embedded" || variant === "embedded-unified"
          ? " video-upload-form--embedded"
          : ""
      }`}
      layout={homeMotionEnabled}
      transition={layoutTransition}
    >
      <form onSubmit={handleSubmit} className="video-extractor-form-inner">
        <div className="video-extractor-url-row">
          <label
            htmlFor={variant === "embedded-unified" ? "recipe-source-url" : "tiktok-url"}
            className="visually-hidden"
          >
            {variant === "embedded-unified" ? "Recipe or video URL" : "TikTok URL"}
          </label>
          <div className="video-extractor-input-wrap">
            <span className="video-extractor-link-icon" aria-hidden>
              <IconLink />
            </span>
            <input
              id={variant === "embedded-unified" ? "recipe-source-url" : "tiktok-url"}
              type="url"
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder={
                variant === "embedded-unified"
                  ? "https://www.tiktok.com/... or recipe page URL"
                  : "https://www.tiktok.com/..."
              }
              className="form-input video-extractor-url-input"
              disabled={uploading || webImportInFlight}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className={`submit-button video-extractor-submit${submitBusy ? " video-extractor-submit--busy" : ""}`}
            disabled={uploading || inProgress || !tiktokUrl.trim()}
          >
            <span className="video-extractor-submit-inner">
              {submitBusy ? (
                <>
                  <span className="video-extractor-submit-sparkle" aria-hidden>
                    {"\u2728"}
                  </span>
                  <span className="video-extractor-submit-busy-text">Processing…</span>
                </>
              ) : (
                "Cook It! 🔥"
              )}
            </span>
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </form>

      {jobStatus && (
        <motion.div className="job-status" layout={homeMotionEnabled} transition={layoutTransition}>
          {!inProgress && (
            <h3 className="job-status-heading">Status</h3>
          )}

          <AnimatePresence initial={false}>
            {inProgress ? (
              <motion.div
                key="video-progress"
                layout={homeMotionEnabled}
                initial={homeMotionEnabled ? { opacity: 0, y: 6 } : false}
                animate={homeMotionEnabled ? { opacity: 1, y: 0 } : undefined}
                exit={homeMotionEnabled ? { opacity: 0, y: -4 } : undefined}
                transition={layoutTransition}
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
              </motion.div>
            ) : null}
          </AnimatePresence>

          {!inProgress && (
            <div
              className={`status-badge status-${jobStatus.status} status-badge--subtle`}
            >
              {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
            </div>
          )}

          <AnimatePresence initial={false}>
            {jobStatus.status === "done" && editedRecipe && recipeTemplate && jobId ? (
              <motion.div
                key="video-editor"
                className="video-recipe-template-embed"
                layout={homeMotionEnabled}
                initial={homeMotionEnabled ? { opacity: 0, y: 8 } : false}
                animate={homeMotionEnabled ? { opacity: 1, y: 0 } : undefined}
                transition={layoutTransition}
              >
                <RecipeTemplateShell
                  template={recipeTemplate}
                  nutritionLocked={!entitlements.isPro}
                  onNutritionLockedClick={() => setUpgradeReason("nutrition")}
                  draftTitle={{
                    value: editedRecipe.title,
                    onChange: (value) =>
                      setEditedRecipe((prev) => (prev ? { ...prev, title: value } : null)),
                    placeholder: "Recipe name",
                  }}
                  favoriteSlot={
                    <div className="video-draft-header-actions">
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
                  }
                  mobileSaveSlot={
                    <div className="video-draft-mobile-cta">
                      <button
                        type="button"
                        className="video-recipe-copy-btn"
                        onClick={() => void copyRecipe()}
                      >
                        Copy recipe
                      </button>
                      <button
                        type="button"
                        className="submit-button video-recipe-save-btn"
                        onClick={() => setSaveModalOpen(true)}
                      >
                        Save to cookbook
                      </button>
                    </div>
                  }
                  cookIngredientsPanel={
                    <>
                      <div className="recipe-template-panel-head">
                        <h2 className="recipe-template-panel-title">
                          <span aria-hidden>🛒</span> Ingredients
                        </h2>
                        {editedRecipe.ingredientLines.some((s) => s.trim()) ? (
                          <button
                            type="button"
                            className="recipe-template-link-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAddAllIngredients();
                            }}
                            disabled={addAllBusy}
                          >
                            {addAllBusy ? "Adding…" : "+ Add to grocery list"}
                          </button>
                        ) : null}
                      </div>
                      {groceryFeedback ? (
                        <p role="status" className="recipe-fullview-grocery-feedback">
                          {groceryFeedback}
                        </p>
                      ) : null}
                      <ul
                        className="recipe-ingredients-list"
                        style={{ listStyle: "none", margin: 0, padding: 0 }}
                      >
                        {editedRecipe.ingredientLines.map((line, i) => {
                          const { displayName, displayQuantity } =
                            splitIngredientLineForTemplate(line);
                          const rawLine = line.trim();
                          return (
                            <li key={i} className="recipe-template-ingredient-row">
                              <input type="checkbox" disabled aria-hidden />
                              <input
                                type="text"
                                className="recipe-template-ingredient-name video-draft-input-plain"
                                value={displayName}
                                onChange={(e) => {
                                  const next = [...editedRecipe.ingredientLines];
                                  next[i] = mergeIngredientParts(displayQuantity, e.target.value);
                                  setEditedRecipe((prev) =>
                                    prev ? { ...prev, ingredientLines: next } : null
                                  );
                                }}
                                placeholder="Ingredient"
                                aria-label={`Ingredient ${i + 1} name`}
                              />
                              <input
                                type="text"
                                className="recipe-template-ingredient-qty video-draft-input-plain"
                                value={displayQuantity}
                                onChange={(e) => {
                                  const next = [...editedRecipe.ingredientLines];
                                  next[i] = mergeIngredientParts(e.target.value, displayName);
                                  setEditedRecipe((prev) =>
                                    prev ? { ...prev, ingredientLines: next } : null
                                  );
                                }}
                                placeholder="Qty"
                                aria-label={`Ingredient ${i + 1} quantity`}
                              />
                              <button
                                type="button"
                                className="recipe-ingredient-add-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (rawLine) void handleAddIngredient(rawLine);
                                }}
                                disabled={!rawLine}
                                title={
                                  rawLine
                                    ? `Add ${rawLine} to grocery list`
                                    : "Add ingredient to grocery list"
                                }
                                aria-label={`Add ${rawLine || "ingredient"} to grocery list`}
                              >
                                <AddToGroceryIcon />
                              </button>
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
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        type="button"
                        className="recipe-template-show-more"
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
                    </>
                  }
                  cookInstructionsPanel={
                    <>
                      <div className="recipe-template-panel-head">
                        <h2 className="recipe-template-panel-title">
                          <span aria-hidden>👨‍🍳</span> Instructions
                        </h2>
                      </div>
                      <ol className="recipe-template-steps-list">
                        {editedRecipe.steps.map((step, i) => (
                          <li key={i} className="recipe-template-step-card">
                            <span className="recipe-template-step-num">{i + 1}</span>
                            <textarea
                              className="recipe-template-step-text video-draft-step-textarea"
                              value={step}
                              onChange={(e) => {
                                const next = [...editedRecipe.steps];
                                next[i] = e.target.value;
                                setEditedRecipe((prev) =>
                                  prev ? { ...prev, steps: next } : null
                                );
                              }}
                              placeholder="Step"
                              aria-label={`Step ${i + 1}`}
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
                          </li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        className="recipe-template-show-more"
                        onClick={() =>
                          setEditedRecipe((prev) =>
                            prev ? { ...prev, steps: [...prev.steps, ""] } : null
                          )
                        }
                      >
                        + Add step
                      </button>
                    </>
                  }
                  nutritionPanel={
                    <>
                      <div className="recipe-template-panel-head">
                        <h2 className="recipe-template-panel-title">Nutrition</h2>
                      </div>
                      <div className="recipe-template-nutrition-macros">
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-icon">
                            <span aria-hidden>🔥</span>
                          </div>
                          <div
                            className="recipe-template-stat-value"
                            title={recipeTemplate.nutrition.caloriesTitle}
                          >
                            {recipeTemplate.nutrition.caloriesDisplay}
                          </div>
                          <div className="recipe-template-stat-label">Calories</div>
                        </div>
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-value">
                            {macroGDisplay(recipeTemplate.nutrition.proteinG)}
                          </div>
                          <div className="recipe-template-stat-label">Protein</div>
                        </div>
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-value">
                            {macroGDisplay(recipeTemplate.nutrition.carbG)}
                          </div>
                          <div className="recipe-template-stat-label">Carbs</div>
                        </div>
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-value">
                            {macroGDisplay(recipeTemplate.nutrition.fatG)}
                          </div>
                          <div className="recipe-template-stat-label">Fat</div>
                        </div>
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-value">
                            {macroGDisplay(recipeTemplate.nutrition.fiberG)}
                          </div>
                          <div className="recipe-template-stat-label">Fiber</div>
                        </div>
                        <div className="recipe-template-stat-card">
                          <div className="recipe-template-stat-value">
                            {macroGDisplay(recipeTemplate.nutrition.sugarG)}
                          </div>
                          <div className="recipe-template-stat-label">Sugar</div>
                        </div>
                      </div>
                      <p
                        className={`recipe-fullview-nutrition-source recipe-fullview-nutrition-source--${nutritionSource}`}
                        style={{ marginBottom: 16 }}
                        title={
                          draftRecipeRow
                            ? recipeNutritionSourceDetail(draftRecipeRow, nutritionSource)
                            : undefined
                        }
                      >
                        Nutrition: {nutritionSourceLabel}
                      </p>
                      <div className="recipe-template-nutrition-meta">
                        <h3
                          className="recipe-template-panel-title"
                          style={{ fontSize: "15px", marginBottom: 8 }}
                        >
                          Recipe details
                        </h3>
                        <dl className="recipe-template-meta-dl">
                          <dt className="recipe-template-meta-dt">Prep time</dt>
                          <dd className="recipe-template-meta-dd">—</dd>
                          <dt className="recipe-template-meta-dt">Cook time</dt>
                          <dd className="recipe-template-meta-dd">
                            <input
                              id="video-recipe-cook-time"
                              type="number"
                              min={0}
                              className="video-draft-meta-input"
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
                          </dd>
                          <dt className="recipe-template-meta-dt">Total time</dt>
                          <dd className="recipe-template-meta-dd">
                            {editedRecipe.cookTimeMinutes > 0 ? `${editedRecipe.cookTimeMinutes} min` : "—"}
                          </dd>
                          <dt className="recipe-template-meta-dt">Servings</dt>
                          <dd className="recipe-template-meta-dd">
                            <input
                              id="video-recipe-servings"
                              type="number"
                              min={1}
                              className="video-draft-meta-input"
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
                          </dd>
                          <dt className="recipe-template-meta-dt">Cuisine</dt>
                          <dd className="recipe-template-meta-dd">{recipeTemplate.metadata.cuisine ?? "—"}</dd>
                          <dt className="recipe-template-meta-dt">Meal type</dt>
                          <dd className="recipe-template-meta-dd">{recipeTemplate.metadata.mealType ?? "—"}</dd>
                          <dt className="recipe-template-meta-dt">Difficulty</dt>
                          <dd className="recipe-template-meta-dd">—</dd>
                          <dt className="recipe-template-meta-dt">Source URL</dt>
                          <dd className="recipe-template-meta-dd">
                            {recipeTemplate.metadata.sourceUrl ? (
                              <a
                                href={recipeTemplate.metadata.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open link
                              </a>
                            ) : (
                              "—"
                            )}
                          </dd>
                          <dt className="recipe-template-meta-dt">Creator</dt>
                          <dd className="recipe-template-meta-dd">{recipeTemplate.metadata.creatorLine ?? "—"}</dd>
                        </dl>
                      </div>
                    </>
                  }
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

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
        </motion.div>
      )}

      <SaveRecipeToCookbookModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        payload={saveModalOpen ? getPayloadFromEdited() : null}
      />
      <UpgradePrompt
        open={upgradeReason !== null}
        reason={upgradeReason ?? "nutrition"}
        onClose={() => setUpgradeReason(null)}
      />
    </motion.div>
  );
}
