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
  /** Max frames to OCR when selectMode=smart (after blur/dup filters) */
  maxOcrFrames: number;
  /** Minimum frames to OCR even if scores are low */
  minOcrFrames: number;
  /** Optional crop to likely text region before OCR */
  cropTextRegions: boolean;
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
 * score as too blurry (Laplacian variance vs `minLaplacianVariance`; OpenCV path when the engine
 * loads OpenCV) or as near-duplicates of a prior kept frame (dHash vs `duplicateMaxHamming`) are
 * removed from the OCR list when `skipBlur` / `skipDuplicate` are true and `metricsOnly` is false.
 * Set `metricsOnly` true to populate `would_skip_*` in metrics while still OCRing every frame.
 */
export function readVisionConfig(): VisionConfig {
  const engineRaw = (process.env.VISION_ENGINE || "auto").toLowerCase();
  const engine =
    engineRaw === "opencv" || engineRaw === "fallback" || engineRaw === "auto"
      ? (engineRaw as VisionConfig["engine"])
      : "auto";

  const selectRaw = (process.env.VISION_SELECT_MODE || "none").toLowerCase();
  const selectMode: VisionSelectMode =
    selectRaw === "smart" ? "smart" : "none";

  return {
    enabled: envBool("VISION_ENABLED", true),
    metricsOnly: envBool("VISION_METRICS_ONLY", false),
    engine,
    skipBlur: envBool("VISION_SKIP_BLUR", true),
    skipDuplicate: envBool("VISION_SKIP_DUPES", true),
    minLaplacianVariance: envFloat("VISION_MIN_LAPLACIAN_VARIANCE", 120),
    duplicateMaxHamming: envInt("VISION_DHASH_MAX_HAMMING", 10),
    selectMode,
    maxOcrFrames: envInt("VISION_MAX_OCR_FRAMES", 40),
    minOcrFrames: envInt("VISION_MIN_OCR_FRAMES", 8),
    cropTextRegions: envBool("VISION_CROP_TEXT_REGIONS", false),
  };
}
