import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { ensureProfile } from "@/app/actions/profiles";
import { assertCanExtract } from "@/lib/entitlements";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureProfile();

    const extractGate = await assertCanExtract(userId);
    if (!extractGate.ok) {
      return NextResponse.json(extractGate.limit, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const url = typeof (body as any)?.url === "string" ? (body as any).url.trim() : "";

    if (!url) {
      return NextResponse.json(
        { error: "TikTok URL is required" },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid TikTok URL" },
        { status: 400 }
      );
    }

    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes("tiktok.com")) {
      return NextResponse.json(
        { error: "Please provide a valid TikTok URL" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const jobId = crypto.randomUUID();

    const { data: job, error: jobError } = await supabase
      .from("video_processing_jobs")
      .insert({
        id: jobId,
        user_id: userId,
        status: "uploaded",
        video_url: "", // will be provided by worker for URL-based jobs
        tiktok_url: url,
      })
      .select()
      .single();

    if (jobError) {
      console.error("URL job creation error:", jobError);
      return NextResponse.json(
        { error: "Failed to create processing job" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        message: "TikTok URL received. Processing will begin shortly.",
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("URL upload error:", err.message, err.stack);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(isDev && { detail: err.message }),
      },
      { status: 500 }
    );
  }
}

