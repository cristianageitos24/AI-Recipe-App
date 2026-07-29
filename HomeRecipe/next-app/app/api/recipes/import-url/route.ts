import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserIdForApi } from "@/lib/auth";
import { assertCanExtract } from "@/lib/entitlements";

const IMPORT_API_BASE =
  process.env.RECIPE_URL_IMPORT_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUserIdForApi();
    if (authResult.response) return authResult.response;
    const { userId } = authResult;

    const extractGate = await assertCanExtract(userId);
    if (!extractGate.ok) {
      return NextResponse.json(extractGate.limit, { status: 403 });
    }

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

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
