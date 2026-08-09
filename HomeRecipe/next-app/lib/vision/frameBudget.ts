/**
 * Duration-scaled OCR / vision-LLM frame budgets (accuracy-first).
 */

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Frames to extract for OCR (~1/sec), capped by hardMax. */
export function extractFrameCapForDuration(
  durationSec: number,
  hardMax: number
): number {
  const d = Math.max(0, durationSec);
  return clampInt(Math.ceil(d), 1, hardMax);
}

/**
 * Max frames to OCR after blur/dupe + smart select.
 * Scales with duration (~0.55–0.75 × seconds), clamp 24–120.
 */
export function ocrBudgetForDuration(durationSec: number): number {
  const d = Math.max(1, durationSec);
  let rate = 0.75;
  if (d > 90) rate = 0.65;
  if (d > 150) rate = 0.55;
  const min = parseInt(process.env.VISION_MIN_OCR_FRAMES || "24", 10);
  const max = parseInt(process.env.VISION_MAX_OCR_FRAMES_CAP || "120", 10);
  return clampInt(
    d * rate,
    Number.isFinite(min) && min > 0 ? min : 24,
    Number.isFinite(max) && max > 0 ? max : 120
  );
}

/** Color frames for multimodal food/label inventory. */
export function visionLlmFrameCountForDuration(durationSec: number): number {
  const d = Math.max(1, durationSec);
  if (d < 90) return 8;
  if (d < 150) return 12;
  return 16;
}
