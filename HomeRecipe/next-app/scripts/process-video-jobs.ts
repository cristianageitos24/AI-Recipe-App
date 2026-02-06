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
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  createOCRProvider,
  getVideoDuration,
  processVideo,
  withTimeout,
} from "../lib/video-processing";
import { extractAudioToWav, transcribeWithWhisper } from "../lib/transcription";
import { extractRecipeFromVideo } from "../lib/recipe-reasoning";
import type { ExtractedRecipe } from "../lib/types";

// Load .env.local from script dir (next-app) or cwd (when run via npm from next-app)
const envLocal = resolve(__dirname, "../.env.local");
const envCwd = resolve(process.cwd(), ".env.local");
dotenv.config({ path: envLocal });
if (envCwd !== envLocal) dotenv.config({ path: envCwd });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

// Configuration
const MAX_ATTEMPTS = 3;
const MAX_DURATION_SECONDS = parseInt(
  process.env.VIDEO_MAX_DURATION_SECONDS || "120",
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
  process.env.WORKER_LOCK_TIMEOUT_MINUTES || "10",
  10
);
const TRANSCRIPTION_TIMEOUT_MS = parseInt(
  process.env.TRANSCRIPTION_TIMEOUT_MS || "60000",
  10
);
const WORKER_ID =
  process.env.WORKER_ID || `${hostname()}-${process.pid}`;

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
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
  tiktok_url: string | null;
  attempts: number;
  locked_at: string | null;
}

/**
 * Log with structured format
 */
function log(level: "INFO" | "ERROR" | "DEBUG", message: string, data?: any) {
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
 * Reset job for retry
 */
async function resetJobForRetry(jobId: string, attempt: number) {
  const backoffDelay = getBackoffDelay(attempt);
  log("INFO", `Resetting job for retry`, {
    jobId,
    attempt,
    backoffMs: backoffDelay,
  });

  const { error } = await supabase
    .from("video_processing_jobs")
    .update({
      status: "uploaded",
      locked_at: null,
      locked_by: null,
      started_at: null,
      error_message: null,
    })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to reset job", { jobId, error: error.message });
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
 * Mark job as completed (with optional extracted recipe from AI reasoning)
 */
async function markJobCompleted(
  jobId: string,
  ocrText: string,
  processingMs: number,
  transcriptText: string | null,
  extractedRecipe: ExtractedRecipe | null
) {
  log("INFO", "Job completed", {
    jobId,
    processingMs,
    textLength: ocrText.length,
    hasExtractedRecipe: extractedRecipe != null,
  });

  const { error } = await supabase
    .from("video_processing_jobs")
    .update({
      status: "done",
      ocr_text: ocrText,
      transcript_text: transcriptText,
      extracted_recipe: extractedRecipe,
      processing_ms: processingMs,
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);

  if (error) {
    log("ERROR", "Failed to mark job as completed", {
      jobId,
      error: error.message,
    });
  }
}

/**
 * Download video from Supabase Storage
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

    // Download video
    videoPath = await downloadVideo(job.video_url);

    // Check video duration
    const duration = await getVideoDuration(videoPath);
    log("DEBUG", "Video duration", { jobId: job.id, duration });

    if (duration > MAX_DURATION_SECONDS) {
      throw new Error(
        `Video duration (${duration}s) exceeds maximum (${MAX_DURATION_SECONDS}s)`
      );
    }

    // Transcription: extract audio and transcribe (non-fatal on failure)
    const audioTranscriptionKey = process.env.OPENAI_AUDIO_TRANSCRIPTION_KEY;
    if (audioTranscriptionKey) {
      wavPath = join(tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);
      try {
        await extractAudioToWav(videoPath, wavPath);
        transcriptText = await transcribeWithWhisper(wavPath, audioTranscriptionKey, TRANSCRIPTION_TIMEOUT_MS);
        await updateJobTranscript(job.id, transcriptText);
        log("DEBUG", "Transcription complete", { jobId: job.id, transcriptLength: transcriptText?.length ?? 0 });
      } catch (transcriptionError: any) {
        log("ERROR", "Transcription failed, continuing with OCR", {
          jobId: job.id,
          error: transcriptionError?.message ?? transcriptionError,
        });
        transcriptText = null;
        await updateJobTranscript(job.id, null);
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

    // Process video with timeout (1 frame/sec, capped at MAX_FRAMES)
    const maxFrames = Math.min(
      Math.ceil(duration),
      MAX_FRAMES
    );
    log("DEBUG", "Processing frames", { jobId: job.id, duration, maxFrames });
    const processingPromise = processVideo(videoPath, ocrProvider!, maxFrames);
    const ocrText = await withTimeout(
      processingPromise,
      PROCESSING_TIMEOUT_MS,
      `Processing exceeded timeout of ${PROCESSING_TIMEOUT_MS}ms`
    );

    const processingMs = Date.now() - startTime;

    // AI reasoning: extract structured recipe from OCR + transcript (non-fatal)
    let extractedRecipe: ExtractedRecipe | null = null;
    const reasoningKey = process.env.OPENAI_REASONING_API_KEY;
    if (reasoningKey && (ocrText.trim().length > 0 || (transcriptText ?? "").trim().length > 0)) {
      try {
        extractedRecipe = await extractRecipeFromVideo(ocrText, transcriptText, {
          apiKey: reasoningKey,
          log: (message, data) => log("DEBUG", message, data),
        });
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

    // Mark as completed
    await markJobCompleted(job.id, ocrText, processingMs, transcriptText, extractedRecipe);
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    log("ERROR", "Job processing error", {
      jobId: job.id,
      error: errorMessage,
      attempts: job.attempts,
    });

    // Check if we should retry
    if (job.attempts < MAX_ATTEMPTS) {
      await resetJobForRetry(job.id, job.attempts);
    } else {
      await markJobFailed(job.id, errorMessage);
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
  log("INFO", "Worker starting", {
    workerId: WORKER_ID,
    maxDuration: MAX_DURATION_SECONDS,
    maxFrames: MAX_FRAMES,
    timeout: PROCESSING_TIMEOUT_MS,
    transcriptionTimeout: TRANSCRIPTION_TIMEOUT_MS,
    pollInterval: POLL_INTERVAL_MS,
  });

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
