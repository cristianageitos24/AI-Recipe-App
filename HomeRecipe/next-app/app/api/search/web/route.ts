import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { WebSearchResult } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const queryCache = new Map<string, { results: WebSearchResult[]; expiresAt: number }>();

function parseResults(text: string): WebSearchResult[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r): r is WebSearchResult =>
          typeof r?.title === "string" && typeof r?.url === "string",
      );
    }
  } catch {
    // JSON mode may have been ignored by grounding — fall back to extraction
  }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];
  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is WebSearchResult =>
        typeof r?.title === "string" && typeof r?.url === "string",
    );
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const cacheKey = query.toLowerCase();
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ results: cached.results }, { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini is not configured. Add GEMINI_API_KEY to .env.local." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
    You are an elite culinary search planner and data-structuring agent for HomeRecipe. Your task is to interpret natural language requests, execute precise searches using the Google Search grounding tool, and serialize the results into a strict JSON schema.

    Step 1 — Interpret the user's query:
    Deconstruct conversational, creative, or metaphorical queries (e.g., "christmas steak with a hint of halloween meant for two") into:

    Core Subject: Main protein or dish type (e.g., Steak)

    Primary Theme: Dominant style or occasion (e.g., Christmas)

    Secondary Theme: Flavor accent or visual contrast (e.g., Halloween)

    Constraints: Serving size (e.g., Meant for two / 2 servings) or dietary limits.

    Translate this intent into broad search concepts to maximize the quality of the results fetched by the grounding engine.

    Step 2 — Evaluate and select:
    Review the real-time search results. Extract up to 8 recipes that point directly to individual pages with ingredients and step-by-step instructions.

    Strictly exclude listicles, blog roundups, site directories, homepages, or blogs requiring paid subscriptions/logins.
    Strictly exclude any video content — no YouTube, TikTok, Instagram Reels, Facebook videos, Vimeo, or any other video platform. Only accept text-based recipe pages with written ingredients and instructions.

    Step 3 — Format the output:
    Output a JSON array of objects matching this exact structure:
    [{ "title": string, "url": string, "source": string, "snippet": string }]

    Rules:

    source: Domain name only (e.g., "allrecipes.com").

    snippet: One concise sentence explaining exactly how this recipe satisfies the user's specific query themes.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `User Query: "${query}"`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";
    const results = parseResults(text);

    queryCache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });

    if (process.env.NODE_ENV === "development") {
      console.log("[web-search] results:", results.length, "for:", query);
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[web-search] error:", err.message);
    const isQuota =
      err.message.includes("429") ||
      err.message.includes("RESOURCE_EXHAUSTED") ||
      err.message.includes("quota");
    return NextResponse.json(
      {
        error: isQuota
          ? "Search limit reached. Please try again in a moment."
          : "Web recipe search failed.",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: isQuota ? 429 : 500 },
    );
  }
}
