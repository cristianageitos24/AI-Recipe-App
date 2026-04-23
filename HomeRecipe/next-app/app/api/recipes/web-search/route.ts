import { NextRequest, NextResponse } from "next/server";

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  image?: unknown;
  image_url?: unknown;
  images?: unknown;
};

type TavilyImage = string | { url?: unknown; image_url?: unknown; src?: unknown };

const RECIPE_SEARCH_DOMAINS = [
  "allrecipes.com",
  "foodnetwork.com",
  "epicurious.com",
  "myrecipes.com",
  "delish.com",
  "thekitchn.com",
  "seriouseats.com",
  "bonappetit.com",
  "kingarthurbaking.com",
  "americastestkitchen.com",
  "cooksillustrated.com",
];

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function imageToUrl(image: TavilyImage | undefined): string | null {
  if (!image) return null;
  if (typeof image === "string") return image.trim() || null;
  return asString(image.url) ?? asString(image.image_url) ?? asString(image.src);
}

function firstImageFromList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value as TavilyImage[]) {
    const url = imageToUrl(item);
    if (url) return url;
  }
  return null;
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Recipe site";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tavily is not configured. Add TAVILY_API_KEY to .env.local." },
        { status: 500 },
      );
    }

    const upstream = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} recipe`,
        search_depth: "advanced",
        max_results: 20,
        include_images: true,
        include_domains: RECIPE_SEARCH_DOMAINS,
        chunks_per_source: 5,
      }),
      cache: "no-store",
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            payload?.detail ||
            payload?.error ||
            payload?.message ||
            "Tavily search failed.",
        },
        { status: upstream.status },
      );
    }

    const images = Array.isArray(payload?.images)
      ? (payload.images as TavilyImage[])
      : [];
    const firstImage = imageToUrl(images[0]);
    const results = Array.isArray(payload?.results)
      ? (payload.results as TavilyResult[])
          .map((result, index) => {
            const url = asString(result.url);
            if (!url) return null;

            const title = asString(result.title) ?? sourceFromUrl(url);
            const image =
              firstImageFromList(result.images) ??
              imageToUrl(result.image as TavilyImage) ??
              imageToUrl(result.image_url as TavilyImage) ??
              firstImage;

            return {
              id: `${url}-${index}`,
              title,
              url,
              source: sourceFromUrl(url),
              snippet: asString(result.content),
              image,
            };
          })
          .filter(Boolean)
      : [];

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      {
        error: "Web recipe search failed.",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
