/**
 * Combine per-frame signals into a single ranking score.
 */

import type { FrameAnalysis } from "./types";

/** Normalize laplacian variance (typical range after scaling) */
function normLap(v: number): number {
  return Math.min(1, v / 2000);
}

export function computeCombinedScore(f: {
  laplacianVariance: number;
  brightness: number;
  contrast: number;
  textLikelihood: number;
  sceneChangeScore: number;
}): number {
  const sharpness = normLap(f.laplacianVariance);
  const bc = Math.min(1, f.contrast / 64) * 0.15;
  const brightOk =
    f.brightness > 30 && f.brightness < 240 ? 0.1 : 0.02;
  const text = f.textLikelihood * 0.35;
  const scene = f.sceneChangeScore * 0.15;
  return sharpness * 0.35 + bc + brightOk + text + scene;
}

export function attachCombinedScore(frame: FrameAnalysis): FrameAnalysis {
  return {
    ...frame,
    combinedScore: computeCombinedScore(frame),
  };
}
