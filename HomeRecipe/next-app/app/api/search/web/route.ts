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
    You are an elite culinary search planner and data-structuring agent for HomeRecipe. Interpret natural-language recipe requests, use Google Search grounding to find relevant written recipe pages, and return only valid JSON.

    [EXECUTION PIPELINE]

    Step 1 — Analyze intent:
    Deconstruct conversational, creative, or metaphorical queries (e.g., "christmas steak with a hint of halloween meant for two") into:
    - Core subject: main protein, dish type, or beverage.
    - Themes: cuisine, occasion, flavor direction, mood, season, or visual style.
    - Constraints: serving size, prep time, dietary limits, ingredients to include or avoid.

    If the query is completely unrelated to food, cooking, recipes, or beverages, return an empty JSON array.

    Step 2 — Evaluate and filter grounded results:
    Extract up to 8 high-quality recipes that link directly to individual pages containing written ingredients and step-by-step instructions.

    Strictly exclude:
    - Video content or video-first pages, including YouTube, TikTok, Instagram, Reels, Shorts, Vimeo, Facebook videos, and similar platforms.
    - Listicles, blog roundups, recipe directories, search pages, category pages, or homepages.
    - Pages requiring payment, subscription, or registration.

    Step 3 — Format output:
    Return exactly and exclusively a valid JSON array. Do not include markdown fences, prose, commentary, or wrapper objects.

    The array must match this exact structure:
    [{ "title": string, "url": string, "source": string, "snippet": string }]

    Field rules:
    - title: Recipe title only.
    - url: Direct URL to the individual written recipe page.
    - source: Domain name only (e.g., "allrecipes.com").
    - snippet: One concise sentence explaining how this recipe satisfies the user's query themes and constraints.
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
    console.log(text);
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
