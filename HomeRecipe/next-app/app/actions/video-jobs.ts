"use server";

import { getAuthUserId } from "@/lib/auth";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ExtractedRecipe } from "@/lib/types";

export interface VideoJob {
  id: string;
  user_id: string;
  status: "uploaded" | "processing" | "done" | "error";
  video_url: string;
  source_type?: "upload" | "url";
  source_url?: string | null;
  source_platform?: string | null;
  video_deleted_at?: string | null;
  tiktok_url: string | null;
  ocr_text: string | null;
  transcript_text: string | null;
  extracted_recipe: ExtractedRecipe | null;
  thumbnail_url: string | null;
  /** 0–100 determinate progress (worker); null if column missing on old rows */
  processing_progress: number | null;
  /** Machine stage id from worker */
  processing_stage: string | null;
  /** Subtext e.g. frame counts */
  processing_detail: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  processing_ms: number | null;
  created_at: string;
  updated_at: string;
  vision_metrics?: Record<string, unknown> | null;
}

/** Single-job poll: includes OCR/transcript for the upload debug panels. */
const VIDEO_JOB_POLL_COLUMNS =
  "id, user_id, status, video_url, source_type, source_url, source_platform, video_deleted_at, tiktok_url, ocr_text, transcript_text, extracted_recipe, thumbnail_url, processing_progress, processing_stage, processing_detail, error_message, attempts, started_at, finished_at, processing_ms, created_at, updated_at, vision_metrics" as const;

const VIDEO_JOB_LIST_COLUMNS =
  "id, status, thumbnail_url, source_type, source_url, source_platform, processing_progress, processing_stage, error_message, created_at, updated_at, finished_at" as const;

/**
 * Get a single video job by ID
 * @param _refreshNonce Pass changing value (e.g. Date.now()) from the client poller so Next never dedupes stale reads.
 */
export async function getVideoJob(jobId: string, _refreshNonce?: number) {
  noStore();
  const userId = await getAuthUserId();
  if (!userId) {
    return { error: "Unauthorized", data: null };
  }

  void _refreshNonce;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select(VIDEO_JOB_POLL_COLUMNS)
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { error: "Job not found", data: null };
    }
    return { error: error.message, data: null };
  }

  return { error: null, data: data as VideoJob };
}

/**
 * Get recent video jobs for the current user (bounded; omits OCR/transcript blobs).
 */
export async function getVideoJobs() {
  noStore();
  const userId = await getAuthUserId();
  if (!userId) {
    return { error: "Unauthorized", data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select(VIDEO_JOB_LIST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { error: error.message, data: [] };
  }

  return { error: null, data: (data ?? []) as VideoJob[] };
}

/**
 * Get the latest video job for the current user
 */
export async function getLatestVideoJob() {
  noStore();
  const userId = await getAuthUserId();
  if (!userId) {
    return { error: "Unauthorized", data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select(VIDEO_JOB_POLL_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { error: null, data: null }; // No jobs yet
    }
    return { error: error.message, data: null };
  }

  return { error: null, data: data as VideoJob };
}
