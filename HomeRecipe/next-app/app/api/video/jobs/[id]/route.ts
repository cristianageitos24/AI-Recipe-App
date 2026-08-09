import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserIdForApi } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

const BASE_COLUMNS =
  "id, user_id, status, video_url, source_type, source_url, source_platform, tiktok_url, extracted_recipe, thumbnail_url, processing_progress, processing_stage, processing_detail, error_message, attempts, started_at, finished_at, processing_ms, created_at, updated_at, vision_metrics";

/**
 * GET /api/video/jobs/:id — poll a video job (mobile + web).
 * Omits huge ocr_text/transcript_text unless ?debug=1.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthUserIdForApi();
  if (authResult.response) return authResult.response;
  const { userId } = authResult;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const columns = debug
    ? `${BASE_COLUMNS}, ocr_text, transcript_text`
    : BASE_COLUMNS;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_processing_jobs")
    .select(columns)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
