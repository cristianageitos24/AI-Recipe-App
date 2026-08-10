#!/usr/bin/env tsx
/**
 * Video Processing Worker
 * Polls for video processing jobs and processes them with OCR
 * 
 * Run with: npm run worker:video
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { hostname } from "os";
import { existsSync, readdirSync } from "fs";
import { writeFile, unlink, mkdir, readFile, rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  createOCRProvider,
  extractThumbnailFrame,
  extractColorFrames,
  getVideoDuration,
  ocrFrameMaxWidth,
  colorFrameMaxWidth,
  processVideo,
  withTimeout,
} from "../lib/video-processing";
import { extractAudioToWav, transcribeWithWhisper } from "../lib/transcription";
import { extractRecipeFromVideo } from "../lib/recipe-reasoning";
import {
  computeRecipeNutritionFromLines,
  computedNutritionToIngredientSnapshots,
} from "../lib/nutrition/sync-recipe-nutrition";
import { formatExtractedIngredientLine } from "../lib/processRecipeData";
import { compressImageLossless } from "../lib/compress-image";
import type { ExtractedRecipe } from "../lib/types";
import {
  readVisionConfig,
  withOcrBudget,
  visionJobMetricsToDbJson,
  ocrBudgetForDuration,
  visionLlmFrameCountForDuration,
  extractFrameCapForDuration,
} from "../lib/vision";
import type { VisionJobMetrics } from "../lib/vision/types";
import { inventoryIngredientsFromColorFrames } from "../lib/vision-llm-inventory";
import type { VisionInventoryResult } from "../lib/vision-llm-inventory";
import { FREE_EXTRACTION_LIMIT } from "../lib/entitlements-constants";

// Load only next-app/.env.local (same file Next.js uses in this project)
const nextAppDir = resolve(__dirname, "..");
dotenv.config({ path: resolve(nextAppDir, ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("  SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:", supabaseSecretKey ? "✓" : "✗");
  process.exit(1);
}

if (!process.env.SUPABASE_SECRET_KEY) {
  console.error(
    "[worker] SUPABASE_SECRET_KEY is not set. The video worker must use the service role key so job updates " +
      "(progress, status) are not blocked by RLS. Add SUPABASE_SECRET_KEY to next-app/.env.local and restart the worker."
  );
  process.exit(1);
}

const supabaseHost =
  (() => {
    try {
      return new URL(supabaseUrl).host;
    } catch {
      return "invalid-supabase-url";
    }
  })();

// Configuration
const MAX_ATTEMPTS = 3;
const MAX_DURATION_SECONDS = parseInt(
  process.env.VIDEO_MAX_DURATION_SECONDS || "240",
  10
);
const LONG_VIDEO_WARN_SECONDS = parseInt(
  process.env.VIDEO_LONG_WARN_SECONDS || "120",
  10
);
const PROCESSING_TIMEOUT_MS = parseInt(
  process.env.VIDEO_PROCESSING_TIMEOUT_MS || "600000",
  10
);
const MAX_FRAMES = parseInt(
  process.env.VIDEO_MAX_FRAMES || "300",
  10
);
const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS || "5000",
  10
);
const LOCK_TIMEOUT_MINUTES = parseInt(
  process.env.WORKER_LOCK_TIMEOUT_MINUTES || "20",
  10
);
const TRANSCRIPTION_TIMEOUT_MS = parseInt(
  process.env.TRANSCRIPTION_TIMEOUT_MS || "120000",
  10
);
const REASONING_TIMEOUT_MS = parseInt(
  process.env.REASONING_TIMEOUT_MS || "120000",
  10
);
const WORKER_ID =
  process.env.WORKER_ID || `${hostname()}-${process.pid}`;

/** Progress bands (0–100) — tune in one place */
const P = {
  startDownload: 2,
  downloaded: 10,
  validated: 14,
  thumbnailDone: 20,
  transcriptionExtract: 23,
  transcriptionMid: 30,
  transcriptionDone: 36,
  ocrStartWithTranscription: 38,
  ocrStartNoTranscription: 22,
  ocrEnd: 70,
  visionLlmStart: 72,
  visionLlmEnd: 80,
  reasoningStart: 82,
  reasoningEnd: 94,
  finalizing: 97,
  complete: 100,
} as const;

const OCR_PROGRESS_EVERY_N = 10;
const OCR_PROGRESS_MIN_MS = 2500;

function clampProgress(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function lerpProgress(min: number, max: number, t: number): number {
  return clampProgress(min + (max - min) * Math.max(0, Math.min(1, t)));
}

type ProgressUpdate = {
  progress: number;
  stage: string;
  detail?: string | null;
};

/**
 * Persist job progress for the dashboard poller
 */
async function updateJobProgress(jobId: string, u: ProgressUpdate) {
  const progress = clampProgress(u.progress);
  const { data: ok, error } = await supabase.rpc("worker_update_video_job_progress", {
    p_job_id: jobId,
    p_progress: progress,
    p_stage: u.stage,
    p_detail: u.detail ?? null,
  });

  if (error) {
    log("ERROR", "Failed to update job progress (RPC)", {
      jobId,
      error: error.message,
      stage: u.stage,
      hint: "Apply migration 023_worker_update_video_job_progress.sql and use SUPABASE_SECRET_KEY.",
    });
    return;
  }

  if (ok !== true) {
    log("ERROR", "updateJobProgress: no row updated (wrong job id?)", {
      jobId,
      stage: u.stage,
    });
    return;
  }

  log("DEBUG", "Job progress updated", {
    jobId,
    progress,
    stage: u.stage,
  });
}

function createOcrThrottleState() {
  let lastWriteAt = 0;

  return {
    shouldWrite(frameIndex: number, frameCount: number): boolean {
      if (frameCount <= 0) return false;
      const lastIdx = frameCount - 1;
      if (frameIndex === 0 || frameIndex === lastIdx) return true;
      if (frameIndex % OCR_PROGRESS_EVERY_N === 0) return true;
      if (Date.now() - lastWriteAt >= OCR_PROGRESS_MIN_MS) return true;
      return false;
    },
    markWritten() {
      lastWriteAt = Date.now();
    },
  };
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Initialize OCR provider
let ocrProvider: Awaited<ReturnType<typeof createOCRProvider>> | null = null;

interface VideoJob {
  id: string;
  user_id: string;
  status: string;
  video_url: string;
  source_type?: "upload" | "url";
  source_url?: string | null;
  source_platform?: string | null;
  tiktok_url: string | null;
  attempts: number;
  locked_at: string | null;
}

/**
 * Log with structured format
 */
function log(level: "INFO" | "ERROR" | "DEBUG" | "WARN", message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    worker: WORKER_ID,
    message,
    ...(data && { data }),
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Calculate backoff delay based on attempt number
 */
function getBackoffDelay(attempt: number): number {
  const delays = [30000, 120000, 600000]; // 30s, 2m, 10m
  return delays[Math.min(attempt - 1, delays.length - 1)] || delays[delays.length - 1];
}

/**
 * Claim a job atomically
 */
async function claimJob(): Promise<VideoJob | null> {
  try {
    const { data, error } = await supabase.rpc("claim_video_job", {
      worker_id: WORKER_ID,
      lock_timeout_minutes: LOCK_TIMEOUT_MINUTES,
    });

    if (error) {
      log("ERROR", "Failed to claim job", { error: error.message });
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as VideoJob;
  } catch (error) {
    log("ERROR", "Exception claiming job", { error });
    return null;
  }
}

/**
 * Reset job for retry with available_at backoff so claim_video_job waits.
 * Keeps last progress (does not snap to 0%) and surfaces a retrying stage for the UI.
 */
async function resetJobForRetry(
  jobId: string,
  attempt: number,
  opts?: { lastError?: string }
) {
  const backoffDelay = getBackoffDelay(attempt);
  const availableAt = new Date(Date.now() + backoffDelay).toISOString();
  const waitSec = Math.round(backoffDelay / 1000);
  log("INFO", `Resetting job for retry`, {
    jobId,
    attempt,
    backoffMs: backoffDelay,
    availableAt,
    lastError: opts?.lastError?.slice(0, 160),
  });

  const { error } = await supabase
    .from("video_processing_jobs")
    .update({
      status: "uploaded",
      locked_at: null,
      locked_by: null,
      started_at: null,
      error_message: null,
      // Keep processing_progress as-is so the bar does not jump 30%→0% on retry.
      processing_stage: "retrying",
      processing_detail: `Retrying soon (attempt ${attempt}/${MAX_ATTEMPTS}) · waiting ~${waitSec}s`,
      available_at: availableAt,
    })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to reset job", { jobId, error: error.message });
  }
}

async function refundExtractionQuota(userId: string, reason: string) {
  try {
    const { data, error } = await supabase.rpc("refund_extraction_quota", {
      p_user_id: userId,
    });
    if (error) {
      log("WARN", "Failed to refund extraction quota", {
        userId,
        reason,
        error: error.message,
      });
      return;
    }
    log("INFO", "Refunded extraction quota", {
      userId,
      reason,
      refunded: data === true,
      freeLimit: FREE_EXTRACTION_LIMIT,
    });
  } catch (e) {
    log("WARN", "Exception refunding extraction quota", {
      userId,
      reason,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Mark job as failed
 */
async function markJobFailed(jobId: string, errorMessage: string) {
  log("ERROR", "Job failed", { jobId, errorMessage });

  const { error } = await supabase
    .from("video_processing_jobs")
    .update({
      status: "error",
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      processing_stage: "error",
      processing_detail: null,
    })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to mark job as failed", {
      jobId,
      error: error.message,
    });
  }
}

/**
 * Update job transcript (call when transcription succeeds or fails)
 */
async function updateJobTranscript(jobId: string, transcriptText: string | null) {
  const { error } = await supabase
    .from("video_processing_jobs")
    .update({ transcript_text: transcriptText })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to update job transcript", {
      jobId,
      error: error.message,
    });
  }
}

/**
 * Resolve FDC / AI nutrition for extracted ingredients (same pipeline as post-save sync).
 * Non-fatal: logs and returns the recipe unchanged on failure.
 */
async function enrichExtractedRecipeWithNutrition(
  recipe: ExtractedRecipe
): Promise<ExtractedRecipe> {
  const rawLines = recipe.ingredients
    .map((ing) => formatExtractedIngredientLine(ing))
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawLines.length === 0) {
    return recipe;
  }
  try {
    const computed = await computeRecipeNutritionFromLines(supabase, {
      rawLines,
      recipeTitle: recipe.title.trim() || "Recipe",
      servings: recipe.servings,
    });
    return {
      ...recipe,
      recipe_nutrition: {
        energy_kcal: computed.energy_kcal,
        protein_g: computed.protein_g,
        fat_g: computed.fat_g,
        carb_g: computed.carb_g,
        nutrition_source: computed.nutrition_source,
        servings: recipe.servings,
      },
      recipe_ingredient_lines: computedNutritionToIngredientSnapshots(computed.lines),
    };
  } catch (e) {
    log("ERROR", "Failed to compute nutrition for extracted recipe", {
      error: e instanceof Error ? e.message : String(e),
    });
    return recipe;
  }
}

/**
 * Mark job as completed (with optional extracted recipe and thumbnail URL)
 */
async function markJobCompleted(
  jobId: string,
  ocrText: string,
  processingMs: number,
  transcriptText: string | null,
  extractedRecipe: ExtractedRecipe | null,
  thumbnailUrl: string | null = null,
  visionMetrics?: VisionJobMetrics
) {
  log("INFO", "Job completed", {
    jobId,
    processingMs,
    textLength: ocrText.length,
    hasExtractedRecipe: extractedRecipe != null,
    hasThumbnail: thumbnailUrl != null,
    hasVisionMetrics: visionMetrics != null,
  });

  const { error } = await supabase
    .from("video_processing_jobs")
    .update({
      status: "done",
      ocr_text: ocrText,
      transcript_text: transcriptText,
      extracted_recipe: extractedRecipe,
      thumbnail_url: thumbnailUrl,
      processing_ms: processingMs,
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      processing_progress: P.complete,
      processing_stage: "complete",
      processing_detail: null,
    })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to mark job as completed", {
      jobId,
      error: error.message,
    });
    return;
  }

  // Second update: JSONB only, so failures are obvious in logs (migration / schema / RLS).
  if (visionMetrics) {
    const payload = visionJobMetricsToDbJson(visionMetrics);
    const { error: vmError } = await supabase
      .from("video_processing_jobs")
      .update({ vision_metrics: payload })
      .eq("id", jobId);

    if (vmError) {
      log("ERROR", "Failed to persist vision_metrics on job row", {
        jobId,
        error: vmError.message,
        code: (vmError as { code?: string }).code,
        hint:
          "Run migration 024_video_job_vision_metrics.sql on this Supabase project so the vision_metrics column exists.",
      });
    } else {
      log("INFO", "vision_metrics saved", {
        jobId,
        frames_extracted: payload.frames_extracted,
        vision_engine: payload.vision_engine,
        vision_ms: payload.vision_ms,
        ocr_ms: payload.ocr_ms,
      });
    }
  } else {
    log("WARN", "No vision metrics object to persist (unexpected)", { jobId });
  }
}

const VIDEO_THUMBNAIL_TIME_SEC = parseInt(
  process.env.VIDEO_THUMBNAIL_TIME_SEC || "1",
  10
);

/**
 * Extract one color frame, upload to recipe-covers bucket, return public URL or null on failure.
 */
async function extractAndUploadThumbnail(
  videoPath: string,
  jobId: string,
  userId: string,
  durationSeconds: number
): Promise<string | null> {
  const timeSec = Math.min(
    Math.max(VIDEO_THUMBNAIL_TIME_SEC, 0),
    Math.max(0, durationSeconds - 0.5)
  );
  const thumbPath = join(tmpdir(), `thumb-${jobId}-${Date.now()}.png`);
  try {
    await extractThumbnailFrame(videoPath, thumbPath, timeSec);
    const storagePath = `${userId}/${jobId}/cover.png`;
    const rawThumb = await readFile(thumbPath);
    const compressed = await compressImageLossless(rawThumb, "image/png");
    const { error: uploadError } = await supabase.storage
      .from("recipe-covers")
      .upload(storagePath, compressed.buffer, {
        contentType: compressed.contentType,
        upsert: true,
      });
    await unlink(thumbPath);
    if (uploadError) {
      log("ERROR", "Thumbnail upload failed", {
        jobId,
        bucket: "recipe-covers",
        storagePath,
        timeSec,
        supabaseHost,
        error: uploadError.message,
      });
      return null;
    }
    const { data } = supabase.storage.from("recipe-covers").getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err: any) {
    log("ERROR", "Thumbnail extraction/upload failed", {
      jobId,
      bucket: "recipe-covers",
      timeSec,
      supabaseHost,
      error: err?.message ?? String(err),
    });
    try {
      await unlink(thumbPath);
    } catch (_) {}
    return null;
  }
}

/**
 * Download video from Supabase Storage (upload-based jobs)
 */
async function downloadVideo(videoPath: string): Promise<string> {
  const tempPath = join(tmpdir(), `video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

  log("DEBUG", "Downloading video", { videoPath, tempPath });

  const { data, error } = await supabase.storage
    .from("videos")
    .download(videoPath);

  if (error) {
    throw new Error(`Failed to download video: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(tempPath, buffer);

  return tempPath;
}

/**
 * Resolve path to yt-dlp executable so the worker finds it even when PATH is not set
 * (e.g. when run from a background process that didn't inherit updated user PATH).
 */
function getYtDlpExecutable(): string {
  const envPath = process.env.YT_DLP_PATH || process.env.YT_DLP_EXECUTABLE;
  if (envPath && existsSync(envPath)) return envPath;
  if (process.platform === "win32" && process.env.APPDATA) {
    const base = join(process.env.APPDATA, "Python");
    try {
      const dirs = readdirSync(base, { withFileTypes: true }).filter((d: { isDirectory: () => boolean; name: string }) => d.isDirectory() && d.name.startsWith("Python"));
      for (const d of dirs) {
        const exe = join(base, d.name, "Scripts", "yt-dlp.exe");
        if (existsSync(exe)) return exe;
      }
    } catch (_) {}
  }
  return "yt-dlp";
}

/** User-visible yt-dlp failure text (stderr is usually the actionable part). */
const YT_DLP_USER_ERROR_MAX = 3500;

function formatYtDlpFailureMessage(error: unknown): string {
  const e = error as {
    timedOut?: boolean;
    shortMessage?: string;
    message?: string;
    stderr?: string;
    stdout?: string;
    exitCode?: number;
  };
  if (e?.timedOut) {
    return "Downloading the video timed out. Try again or use a shorter clip.";
  }
  const stderr = typeof e?.stderr === "string" ? e.stderr.trim() : "";
  const stdout = typeof e?.stdout === "string" ? e.stdout.trim() : "";
  const hint =
    stderr || stdout || e?.shortMessage || e?.message || "yt-dlp exited with an error.";
  const combined = `TikTok download failed: ${hint}`.slice(0, YT_DLP_USER_ERROR_MAX);
  return combined;
}

/**
 * Download a TikTok video for URL-based jobs.
 * Uses yt-dlp (from YT_DLP_PATH, common install locations, or PATH).
 */
async function downloadTikTokVideo(tiktokUrl: string, jobId: string): Promise<string> {
  const tempDir = tmpdir();
  const tempPath = join(
    tempDir,
    `tiktok-${jobId}-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
  );

  const ytDlp = getYtDlpExecutable();
  log("INFO", "Downloading TikTok video", { jobId, tiktokUrl, tempPath, ytDlp });

  const { execa } = await import("execa");

  try {
    // Prefer TikTok's progressive "download" format; adaptive h264/bytevc1 CDN URLs often 404 from datacenters.
    await execa(ytDlp, ["-f", "download/best", "-o", tempPath, tiktokUrl], {
      timeout: PROCESSING_TIMEOUT_MS,
    });
  } catch (error: any) {
    const stderr =
      typeof error?.stderr === "string" ? error.stderr : String(error?.stderr ?? "");
    log("ERROR", "Failed to download TikTok video", {
      jobId,
      tiktokUrl,
      error: error?.message ?? String(error),
      stderr: stderr.slice(-2000),
    });
    throw new Error(formatYtDlpFailureMessage(error));
  }

  return tempPath;
}

/**
 * Process a single job
 */
async function processJob(job: VideoJob): Promise<void> {
  const startTime = Date.now();
  let videoPath: string | null = null;
  let wavPath: string | null = null;
  let transcriptText: string | null = null;

  try {
    log("INFO", "Processing job", {
      jobId: job.id,
      userId: job.user_id,
      attempts: job.attempts,
    });

    await updateJobProgress(job.id, {
      progress: P.startDownload,
      stage: "downloading",
      detail: null,
    });

    // Choose video source: direct upload vs URL-based TikTok job
    if (job.source_type === "url" || (!job.video_url && job.tiktok_url)) {
      if (!job.tiktok_url) {
        throw new Error("No TikTok URL provided for URL-based job");
      }
      videoPath = await downloadTikTokVideo(job.tiktok_url, job.id);
    } else {
      // Legacy upload-based flow: download from Supabase Storage
      videoPath = await downloadVideo(job.video_url);
    }

    await updateJobProgress(job.id, {
      progress: P.downloaded,
      stage: "validating",
      detail: null,
    });

    // Check video duration
    const duration = await getVideoDuration(videoPath);
    log("DEBUG", "Video duration", { jobId: job.id, duration });

    if (duration > MAX_DURATION_SECONDS) {
      throw new Error(
        `Video duration (${duration}s) exceeds maximum (${MAX_DURATION_SECONDS}s)`
      );
    }

    await updateJobProgress(job.id, {
      progress: P.validated,
      stage: "validating",
      detail:
        duration > LONG_VIDEO_WARN_SECONDS
          ? `${Math.round(duration * 10) / 10}s clip (longer video)`
          : `${Math.round(duration * 10) / 10}s clip`,
    });

    // Thumbnail: extract one color frame and upload to recipe-covers (non-fatal on failure)
    let thumbnailUrl: string | null = null;
    await updateJobProgress(job.id, {
      progress: P.validated + 2,
      stage: "thumbnail",
      detail: "Creating cover image",
    });
    try {
      thumbnailUrl = await extractAndUploadThumbnail(
        videoPath,
        job.id,
        job.user_id,
        duration
      );
    } catch (thumbErr: any) {
      log("ERROR", "Thumbnail failed", { jobId: job.id, error: thumbErr?.message ?? thumbErr });
    }

    await updateJobProgress(job.id, {
      progress: P.thumbnailDone,
      stage: "thumbnail",
      detail: thumbnailUrl ? "Cover image ready" : "Continuing without cover",
    });

    // Transcription: extract audio and transcribe (non-fatal on failure)
    const audioTranscriptionKey = process.env.OPENAI_AUDIO_TRANSCRIPTION_KEY;
    const ocrProgressMin = audioTranscriptionKey
      ? P.ocrStartWithTranscription
      : P.ocrStartNoTranscription;

    if (audioTranscriptionKey) {
      wavPath = join(tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);
      try {
        await updateJobProgress(job.id, {
          progress: P.transcriptionExtract,
          stage: "transcription",
          detail: "Extracting audio",
        });
        await extractAudioToWav(videoPath, wavPath);
        await updateJobProgress(job.id, {
          progress: P.transcriptionMid,
          stage: "transcription",
          detail: "Transcribing speech",
        });
        transcriptText = await transcribeWithWhisper(wavPath, audioTranscriptionKey, TRANSCRIPTION_TIMEOUT_MS);
        await updateJobTranscript(job.id, transcriptText);
        await updateJobProgress(job.id, {
          progress: P.transcriptionDone,
          stage: "transcription",
          detail: transcriptText ? `${transcriptText.length} characters` : null,
        });
        log("DEBUG", "Transcription complete", { jobId: job.id, transcriptLength: transcriptText?.length ?? 0 });
      } catch (transcriptionError: any) {
        log("ERROR", "Transcription failed, continuing with OCR", {
          jobId: job.id,
          error: transcriptionError?.message ?? transcriptionError,
        });
        transcriptText = null;
        await updateJobTranscript(job.id, null);
        await updateJobProgress(job.id, {
          progress: P.transcriptionDone - 2,
          stage: "transcription",
          detail: "Speech-to-text skipped",
        });
      } finally {
        if (wavPath) {
          try {
            await unlink(wavPath);
          } catch (e) {
            log("ERROR", "Failed to cleanup temp audio file", { wavPath, error: e });
          }
          wavPath = null;
        }
      }
    } else {
      log("DEBUG", "OPENAI_AUDIO_TRANSCRIPTION_KEY not set, skipping transcription", { jobId: job.id });
    }

    // Process video with timeout (1 frame/sec extract, duration-scaled OCR budget)
    const maxFrames = extractFrameCapForDuration(duration, MAX_FRAMES);
    const ocrBudget = ocrBudgetForDuration(duration);
    const visionBase = readVisionConfig();
    const visionConfig = withOcrBudget(visionBase, ocrBudget);
    log("DEBUG", "Processing frames", {
      jobId: job.id,
      duration,
      maxFrames,
      ocrBudget,
      ocrFrameMaxWidth: ocrFrameMaxWidth(),
      colorFrameMaxWidth: colorFrameMaxWidth(),
      selectMode: visionConfig.selectMode,
    });

    await updateJobProgress(job.id, {
      progress: ocrProgressMin,
      stage: "ocr",
      detail: maxFrames > 0 ? `Preparing up to ${maxFrames} frames (OCR budget ${ocrBudget})` : "Running OCR",
    });

    const ocrThrottle = createOcrThrottleState();
    const processingPromise = processVideo(
      videoPath,
      ocrProvider!,
      maxFrames,
      async ({ frameIndex, frameCount }) => {
        const pct = lerpProgress(
          ocrProgressMin,
          P.ocrEnd,
          frameCount > 0 ? (frameIndex + 1) / frameCount : 1
        );
        const detail = `OCR ${frameIndex + 1} / ${frameCount}`;
        if (ocrThrottle.shouldWrite(frameIndex, frameCount)) {
          await updateJobProgress(job.id, {
            progress: pct,
            stage: "ocr",
            detail,
          });
          ocrThrottle.markWritten();
        }
      },
      visionConfig
    );
    const { ocrText, metrics: visionMetricsBase } = await withTimeout(
      processingPromise,
      PROCESSING_TIMEOUT_MS,
      `Processing exceeded timeout of ${PROCESSING_TIMEOUT_MS}ms`
    );

    let visionMetrics: VisionJobMetrics = {
      ...visionMetricsBase,
      ocrBudget,
      visionLlmEnabled: visionConfig.visionLlmEnabled,
    };

    log("INFO", "Vision/OCR metrics", {
      jobId: job.id,
      vision: {
        framesExtracted: visionMetrics.framesExtracted,
        framesOcrd: visionMetrics.framesOcrd,
        ocrBudget,
        framesSkippedBlur: visionMetrics.framesSkippedBlur,
        framesSkippedDuplicate: visionMetrics.framesSkippedDuplicate,
        wouldSkipBlur: visionMetrics.wouldSkipBlur,
        wouldSkipDuplicate: visionMetrics.wouldSkipDuplicate,
        visionEngine: visionMetrics.visionEngine,
        visionMs: visionMetrics.visionMs,
        ocrMs: visionMetrics.ocrMs,
      },
    });

    // Multimodal color-frame inventory (non-fatal)
    let visionInventory: VisionInventoryResult | null = null;
    const reasoningKeyEarly = process.env.OPENAI_REASONING_API_KEY;
    if (visionConfig.visionLlmEnabled && reasoningKeyEarly) {
      await updateJobProgress(job.id, {
        progress: P.visionLlmStart,
        stage: "vision_llm",
        detail: "Scanning frames for foods and labels",
      });
      const colorDir = join(tmpdir(), `video-color-${job.id}-${Date.now()}`);
      try {
        await mkdir(colorDir, { recursive: true });
        const colorCount = visionLlmFrameCountForDuration(duration);
        const colorPaths = await extractColorFrames(
          videoPath,
          colorDir,
          colorCount,
          duration
        );
        visionInventory = await inventoryIngredientsFromColorFrames({
          framePaths: colorPaths,
          apiKey: reasoningKeyEarly,
          model: visionConfig.visionLlmModel,
          timeoutMs: visionConfig.visionLlmTimeoutMs,
          log: (message, data) => log("DEBUG", message, data),
        });
        visionMetrics = {
          ...visionMetrics,
          visionLlmFrames: colorPaths.length,
          visionLlmMs: visionInventory?.ms ?? 0,
          visionLlmIngredientCount: visionInventory?.ingredients.length ?? 0,
          visionLlmModel: visionConfig.visionLlmModel,
        };
      } catch (visionErr: unknown) {
        log("ERROR", "Vision LLM pass failed, continuing", {
          jobId: job.id,
          error:
            visionErr instanceof Error ? visionErr.message : String(visionErr),
        });
      } finally {
        try {
          const { readdirSync } = await import("fs");
          for (const f of readdirSync(colorDir)) {
            try {
              await unlink(join(colorDir, f));
            } catch (_) {}
          }
          await rmdir(colorDir);
        } catch (_) {}
      }
      await updateJobProgress(job.id, {
        progress: P.visionLlmEnd,
        stage: "vision_llm",
        detail: visionInventory
          ? `${visionInventory.ingredients.length} foods/labels found`
          : "Vision scan skipped",
      });
    } else {
      log("DEBUG", "Vision LLM disabled or no reasoning key", {
        jobId: job.id,
        enabled: visionConfig.visionLlmEnabled,
      });
    }

    const processingMs = Date.now() - startTime;

    // AI reasoning: extract structured recipe (non-fatal)
    let extractedRecipe: ExtractedRecipe | null = null;
    const reasoningKey = process.env.OPENAI_REASONING_API_KEY;
    await updateJobProgress(job.id, {
      progress: P.reasoningStart,
      stage: "reasoning",
      detail: "Extracting recipe structure",
    });

    if (
      reasoningKey &&
      (ocrText.trim().length > 0 ||
        (transcriptText ?? "").trim().length > 0 ||
        (visionInventory && visionInventory.ingredients.length > 0))
    ) {
      try {
        extractedRecipe = await withTimeout(
          extractRecipeFromVideo(ocrText, transcriptText, {
            apiKey: reasoningKey,
            log: (message, data) => log("DEBUG", message, data),
            visionInventory,
          }),
          REASONING_TIMEOUT_MS,
          `Recipe reasoning exceeded timeout of ${REASONING_TIMEOUT_MS}ms`
        );
        if (extractedRecipe) {
          log("DEBUG", "Recipe reasoning succeeded", { jobId: job.id });
        } else {
          log("DEBUG", "Recipe reasoning failed or skipped", { jobId: job.id });
        }
      } catch (reasoningError: unknown) {
        log("ERROR", "Recipe reasoning error", {
          jobId: job.id,
          error: reasoningError instanceof Error ? reasoningError.message : String(reasoningError),
        });
      }
    } else {
      if (!reasoningKey) {
        log("DEBUG", "OPENAI_REASONING_API_KEY not set, skipping recipe extraction", { jobId: job.id });
      }
    }

    await updateJobProgress(job.id, {
      progress: P.reasoningEnd,
      stage: "reasoning",
      detail: extractedRecipe ? "Recipe structured" : "Using raw text",
    });

    await updateJobProgress(job.id, {
      progress: P.finalizing,
      stage: "finalizing",
      detail: extractedRecipe ? "Computing nutrition" : "Saving results",
    });

    if (extractedRecipe) {
      extractedRecipe = await enrichExtractedRecipeWithNutrition(extractedRecipe);
    }

    await updateJobProgress(job.id, {
      progress: P.finalizing,
      stage: "finalizing",
      detail: "Saving results",
    });

    // Mark as completed
    await markJobCompleted(
      job.id,
      ocrText,
      processingMs,
      transcriptText,
      extractedRecipe,
      thumbnailUrl,
      visionMetrics
    );
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    log("ERROR", "Job processing error", {
      jobId: job.id,
      error: errorMessage,
      attempts: job.attempts,
    });

    const hardFailNoRetry =
      /exceeds maximum|No TikTok URL|Invalid video duration/i.test(errorMessage);

    // Check if we should retry
    if (!hardFailNoRetry && job.attempts < MAX_ATTEMPTS) {
      await resetJobForRetry(job.id, job.attempts, { lastError: errorMessage });
    } else {
      await markJobFailed(job.id, errorMessage);
      // Refund free-tier quota on terminal hard failure (download/duration/etc.)
      await refundExtractionQuota(job.user_id, errorMessage.slice(0, 120));
    }
  } finally {
    // Cleanup downloaded video
    if (videoPath) {
      try {
        await unlink(videoPath);
      } catch (error) {
        log("ERROR", "Failed to cleanup video file", { videoPath, error });
      }
    }
    // Cleanup temp audio if still present (e.g. early exit)
    if (wavPath) {
      try {
        await unlink(wavPath);
      } catch (error) {
        log("ERROR", "Failed to cleanup temp audio file", { wavPath, error });
      }
    }
  }
}

/**
 * Main worker loop
 */
async function main() {
  const hasTranscriptionKey = Boolean(process.env.OPENAI_AUDIO_TRANSCRIPTION_KEY);
  const hasReasoningKey = Boolean(process.env.OPENAI_REASONING_API_KEY);
  const vision = readVisionConfig();
  log("INFO", "Worker starting", {
    workerId: WORKER_ID,
    maxDuration: MAX_DURATION_SECONDS,
    longVideoWarnSeconds: LONG_VIDEO_WARN_SECONDS,
    maxFrames: MAX_FRAMES,
    ocrFrameMaxWidth: ocrFrameMaxWidth(),
    colorFrameMaxWidth: colorFrameMaxWidth(),
    lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES,
    timeout: PROCESSING_TIMEOUT_MS,
    transcriptionTimeout: TRANSCRIPTION_TIMEOUT_MS,
    reasoningTimeout: REASONING_TIMEOUT_MS,
    pollInterval: POLL_INTERVAL_MS,
    OPENAI_AUDIO_TRANSCRIPTION_KEY: hasTranscriptionKey ? "set" : "not set",
    OPENAI_REASONING_API_KEY: hasReasoningKey ? "set" : "not set",
    vision: {
      enabled: vision.enabled,
      metricsOnly: vision.metricsOnly,
      blurSkipsActive:
        vision.enabled && !vision.metricsOnly && vision.skipBlur,
      dupSkipsActive:
        vision.enabled && !vision.metricsOnly && vision.skipDuplicate,
      engine: vision.engine,
      skipBlur: vision.skipBlur,
      skipDupes: vision.skipDuplicate,
      selectMode: vision.selectMode,
      maxOcrFrames: vision.maxOcrFrames,
      minOcrFrames: vision.minOcrFrames,
      cropTextRegions: vision.cropTextRegions,
      keepBlurryMinTextLikelihood: vision.keepBlurryMinTextLikelihood,
      visionLlmEnabled: vision.visionLlmEnabled,
      visionLlmModel: vision.visionLlmModel,
    },
  });
  if (!hasTranscriptionKey) {
    console.warn("[worker] OPENAI_AUDIO_TRANSCRIPTION_KEY is not set — speech-to-text will be skipped. Add it to next-app/.env.local and restart the worker.");
  }
  if (!hasReasoningKey) {
    console.warn("[worker] OPENAI_REASONING_API_KEY is not set — structured recipe extraction will be skipped. Add it to next-app/.env.local and restart the worker.");
  }

  // Initialize OCR provider
  try {
    ocrProvider = await createOCRProvider();
    log("INFO", "OCR provider initialized");
  } catch (error) {
    log("ERROR", "Failed to initialize OCR provider", { error });
    process.exit(1);
  }

  // Graceful shutdown
  let shuttingDown = false;
  process.on("SIGINT", () => {
    log("INFO", "Shutting down gracefully...");
    shuttingDown = true;
  });

  process.on("SIGTERM", () => {
    log("INFO", "Shutting down gracefully...");
    shuttingDown = true;
  });

  // Main polling loop
  while (!shuttingDown) {
    try {
      const job = await claimJob();

      if (job) {
        await processJob(job);
        // Process immediately after completing a job
        continue;
      }

      // No jobs available, sleep
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      log("ERROR", "Unexpected error in main loop", { error });
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  // Cleanup OCR provider
  if (ocrProvider && "terminate" in ocrProvider) {
    await (ocrProvider as any).terminate();
  }

  log("INFO", "Worker stopped");
  process.exit(0);
}

// Start worker
main().catch((error) => {
  log("ERROR", "Fatal error", { error });
  process.exit(1);
});
