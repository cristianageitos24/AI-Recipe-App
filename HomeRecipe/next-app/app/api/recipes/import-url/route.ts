import { NextRequest, NextResponse } from "next/server";

const IMPORT_API_BASE =
  process.env.RECIPE_URL_IMPORT_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
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
