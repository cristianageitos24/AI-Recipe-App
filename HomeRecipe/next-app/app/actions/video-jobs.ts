"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export interface VideoJob {
  id: string;
  user_id: string;
  status: "uploaded" | "processing" | "done" | "error";
  video_url: string;
  tiktok_url: string | null;
  ocr_text: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  processing_ms: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get a single video job by ID
 */
export async function getVideoJob(jobId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select("*")
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
 * Get all video jobs for the current user
 */
export async function getVideoJobs() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, data: [] };
  }

  return { error: null, data: (data ?? []) as VideoJob[] };
}

/**
 * Get the latest video job for the current user
 */
export async function getLatestVideoJob() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select("*")
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
