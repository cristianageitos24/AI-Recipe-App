/**
 * Classifies a user-pasted URL for the unified home extraction box.
 * Extend VIDEO_PLATFORM_MATCHERS to add YouTube Shorts, Instagram Reels, etc.
 */

export type VideoPlatformId = "tiktok" | "youtube_shorts" | "instagram_reels";

export type UrlIngestClassification =
  | { kind: "invalid"; error: string }
  | { kind: "video"; platform: VideoPlatformId }
  | { kind: "webpage" };

type VideoPlatformMatcher = {
  id: VideoPlatformId;
  /** When false, URLs matching this platform return invalid with a friendly message until the worker/API supports them. */
  supported: boolean;
  test: (url: URL) => boolean;
};

/**
 * Order matters: first match wins. Keep more specific matchers before generic ones.
 */
export const VIDEO_PLATFORM_MATCHERS: VideoPlatformMatcher[] = [
  {
    id: "tiktok",
    supported: true,
    test: (u) => u.hostname.includes("tiktok.com"),
  },
  {
    id: "youtube_shorts",
    supported: false,
    test: (u) => {
      const h = u.hostname.replace(/^www\./, "");
      if (h !== "youtube.com" && h !== "youtu.be" && h !== "m.youtube.com") return false;
      const p = u.pathname.toLowerCase();
      return p.includes("/shorts/");
    },
  },
  {
    id: "instagram_reels",
    supported: false,
    test: (u) => {
      const h = u.hostname.replace(/^www\./, "");
      if (!h.endsWith("instagram.com")) return false;
      const p = u.pathname.toLowerCase();
      return p.includes("/reel/") || p.includes("/reels/");
    },
  },
];

const UNSUPPORTED_PLATFORM_MESSAGE: Record<VideoPlatformId, string> = {
  tiktok: "",
  youtube_shorts: "YouTube Shorts isn’t supported yet — we’re working on it.",
  instagram_reels: "Instagram Reels isn’t supported yet — we’re working on it.",
};

export function classifyUrlForIngest(raw: string): UrlIngestClassification {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "invalid", error: "Please enter a URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { kind: "invalid", error: "Please enter a valid URL" };
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return { kind: "invalid", error: "Please use an http(s) URL" };
  }

  for (const matcher of VIDEO_PLATFORM_MATCHERS) {
    if (!matcher.test(parsed)) continue;
    if (!matcher.supported) {
      const msg =
        UNSUPPORTED_PLATFORM_MESSAGE[matcher.id] ||
        "This video source isn’t supported yet — we’re working on it.";
      return { kind: "invalid", error: msg };
    }
    return { kind: "video", platform: matcher.id };
  }

  return { kind: "webpage" };
}
