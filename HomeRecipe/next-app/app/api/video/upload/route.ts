import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { ensureProfile } from "@/app/actions/profiles";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION_SECONDS = parseInt(
  process.env.VIDEO_MAX_DURATION_SECONDS || "120",
  10
);

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureProfile();

    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const tiktokUrl = formData.get("tiktokUrl") as string | null;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Video file is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (videoFile.type !== "video/mp4" && !videoFile.name.endsWith(".mp4")) {
      return NextResponse.json(
        { error: "Only MP4 files are supported" },
        { status: 400 }
      );
    }

    // Validate file size
    if (videoFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Generate job ID
    const jobId = crypto.randomUUID();
    const videoPath = `${userId}/${jobId}.mp4`;

    // Convert File to Buffer for upload
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(videoPath, buffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload video" },
        { status: 500 }
      );
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("video_processing_jobs")
      .insert({
        id: jobId,
        user_id: userId,
        status: "uploaded",
        video_url: videoPath, // Store path, not public URL
        tiktok_url: tiktokUrl || null,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Job creation error:", jobError);
      // Try to clean up uploaded file
      await supabase.storage.from("videos").remove([videoPath]);
      return NextResponse.json(
        { error: "Failed to create processing job" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        message: "Video uploaded successfully. Processing will begin shortly.",
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Upload error:", err.message, err.stack);
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
