import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserIdForApi } from "@/lib/auth";
import { compressImageLossless } from "@/lib/compress-image";
import { createServiceRoleClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MANUAL_RECIPE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function slugifyForPath(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeImageExtension(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const mapped = byType[file.type];
  if (mapped) return mapped;
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "jpg";
}

/**
 * Mobile / API upload for recipe cover images.
 * Mirrors `uploadManualRecipeImage` server action (recipe-covers bucket).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUserIdForApi();
    if (authResult.response) return authResult.response;
    const { userId } = authResult;

    const formData = await request.formData();
    const file = formData.get("image");
    const recipeLabelRaw = formData.get("recipeLabel");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an image file." },
        { status: 400 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are supported." },
        { status: 400 }
      );
    }
    if (file.size > MANUAL_RECIPE_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 8MB or smaller." },
        { status: 400 }
      );
    }

    const recipeLabel =
      typeof recipeLabelRaw === "string" ? recipeLabelRaw : "recipe";
    const labelSlug = slugifyForPath(recipeLabel) || "recipe";
    const ext = normalizeImageExtension(file);
    const timestamp = Date.now();
    const storagePath = `users/${userId}/manual/${timestamp}-${labelSlug}.${ext}`;

    const svc = await createServiceRoleClient();
    const compressed = await compressImageLossless(
      Buffer.from(await file.arrayBuffer()),
      file.type || "image/png"
    );
    const { error: uploadError } = await svc.storage
      .from("recipe-covers")
      .upload(storagePath, compressed.buffer, {
        contentType: compressed.contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = svc.storage.from("recipe-covers").getPublicUrl(storagePath);
    if (!data.publicUrl) {
      return NextResponse.json(
        { error: "Failed to generate image URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.publicUrl }, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      {
        error: "Internal server error",
        detail:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
