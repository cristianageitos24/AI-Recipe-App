import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateHashKey, normalizeSourceUrlForHash } from "@/lib/processRecipeData";

const IMPORT_API_BASE =
  process.env.RECIPE_URL_IMPORT_API_URL || "http://localhost:8000";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const urlHash = generateHashKey(normalizeSourceUrlForHash(url));
    const supabase = getSupabase();

    // Cache hit — return without calling FastAPI
    const { data: cached } = await supabase
      .from("url_import_cache")
      .select("scraped")
      .eq("url_hash", urlHash)
      .single();

    if (cached?.scraped) {
      return NextResponse.json(cached.scraped, { status: 200 });
    }

    // Cache miss — call FastAPI scraper
    const upstream = await fetch(`${IMPORT_API_BASE}/import-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            payload?.detail || payload?.error || "Recipe import request failed",
        },
        { status: upstream.status },
      );
    }

    // Store in cache (fire and forget — don't block the response)
    void Promise.resolve(
      supabase.from("url_import_cache").upsert({ url_hash: urlHash, url, scraped: payload })
    ).catch(() => {});

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    const cause = err.cause;
    const errno =
      cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: string }).code)
        : "";
    const upstreamUnreachable =
      err.message === "fetch failed" || errno === "ECONNREFUSED" || errno === "ENOTFOUND";

    if (upstreamUnreachable) {
      return NextResponse.json(
        {
          error: "Recipe import service is unavailable.",
          detail:
            process.env.NODE_ENV === "development"
              ? `Nothing responded at ${IMPORT_API_BASE}. Run the Python API (e.g. docker compose up recipe-url-import from HomeRecipe, or npm run recipe-import-api). See HomeRecipe/DEPLOY.md for production.`
              : undefined,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        detail:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
