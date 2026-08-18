/**
 * Vision pipeline configuration from environment (worker / scripts only).
 */

export type VisionSelectMode = "none" | "smart";

export type VisionConfig = {
  /** Master switch: false = legacy OCR every frame, no vision analysis */
  enabled: boolean;
  /** If true, compute vision metrics but OCR every frame (safe rollout) */
  metricsOnly: boolean;
  /** opencv | fallback | auto (try opencv, then fallback) */
  engine: "opencv" | "fallback" | "auto";
  skipBlur: boolean;
  skipDuplicate: boolean;
  /** Laplacian variance below this = blurry (tuned for ffmpeg 2x scaled grayscale frames) */
  minLaplacianVariance: number;
  /** Max Hamming distance between consecutive dHashes to count as duplicate */
  duplicateMaxHamming: number;
  selectMode: VisionSelectMode;
  /** Max frames to OCR when selectMode=smart (after blur/dup filters). Overridden per-job by duration scaling when set via applyDurationBudget. */
  maxOcrFrames: number;
  /** Minimum frames to OCR even if scores are low */
  minOcrFrames: number;
  /** Optional crop to likely text region before OCR */
  cropTextRegions: boolean;
  /**
   * Keep blurry frames when textLikelihood is at or above this (0–1).
   * Default 0.35 — accuracy-first for ingredient overlays.
   */
  keepBlurryMinTextLikelihood: number;
  /** Multimodal vision LLM on color frames */
  visionLlmEnabled: boolean;
  visionLlmModel: string;
  visionLlmTimeoutMs: number;
};

function envBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  return /^(1|true|yes|on)$/i.test(v);
}

function envInt(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function envFloat(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Read vision config.
 *
 * Default behavior (when env vars are unset): vision runs on every extracted frame. Frames that
 * score as too blurry (Laplacian variance vs `minLaplacianVariance`) are skipped unless
 * textLikelihood is high enough (`keepBlurryMinTextLikelihood`). Near-duplicates are skipped.
 * `selectMode` defaults to **smart** so OCR budgets stay duration-scaled and timeline-spread.
 */
export function readVisionConfig(): VisionConfig {
  const engineRaw = (process.env.VISION_ENGINE || "auto").toLowerCase();
  const engine =
    engineRaw === "opencv" || engineRaw === "fallback" || engineRaw === "auto"
      ? (engineRaw as VisionConfig["engine"])
      : "auto";

  const selectRaw = (process.env.VISION_SELECT_MODE || "smart").toLowerCase();
  const selectMode: VisionSelectMode =
    selectRaw === "none" ? "none" : "smart";

  return {
    enabled: envBool("VISION_ENABLED", true),
    metricsOnly: envBool("VISION_METRICS_ONLY", false),
    engine,
    skipBlur: envBool("VISION_SKIP_BLUR", true),
    skipDuplicate: envBool("VISION_SKIP_DUPES", true),
    minLaplacianVariance: envFloat("VISION_MIN_LAPLACIAN_VARIANCE", 120),
    duplicateMaxHamming: envInt("VISION_DHASH_MAX_HAMMING", 10),
    selectMode,
    maxOcrFrames: envInt("VISION_MAX_OCR_FRAMES", 80),
    minOcrFrames: envInt("VISION_MIN_OCR_FRAMES", 24),
    cropTextRegions: envBool("VISION_CROP_TEXT_REGIONS", false),
    keepBlurryMinTextLikelihood: envFloat(
      "VISION_KEEP_BLURRY_MIN_TEXT_LIKELIHOOD",
      0.35
    ),
    visionLlmEnabled: envBool("VISION_LLM_ENABLED", true),
    visionLlmModel: process.env.VISION_LLM_MODEL?.trim() || "gpt-4.1-mini",
    visionLlmTimeoutMs: envInt("VISION_LLM_TIMEOUT_MS", 90000),
  };
}

/** Apply per-job OCR budget from duration scaling. */
export function withOcrBudget(
  config: VisionConfig,
  maxOcrFrames: number
): VisionConfig {
  return {
    ...config,
    maxOcrFrames: Math.max(config.minOcrFrames, maxOcrFrames),
    selectMode: "smart",
  };
}
