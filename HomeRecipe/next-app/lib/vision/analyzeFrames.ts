/**
 * Run vision analysis over extracted frame paths (worker-only).
 */

import type { VisionConfig } from "./config";
import type { FrameAnalysis, VisionEngineKind, VisionJobMetrics } from "./types";
import { readVisionConfig } from "./config";
import { measureLaplacianVariance } from "./blur";
import {
  brightnessContrast,
  sceneChangeFromHistogram,
} from "./fallback";
import { dhashForFrame } from "./duplicates";
import { scoreTextLikelihood } from "./textLikelihood";
import { selectFramesForOcr } from "./selectFrames";
import { tryLoadOpenCv } from "./opencv";

function resolveUseOpenCv(config: VisionConfig): boolean {
  if (config.engine === "opencv") return true;
  if (config.engine === "fallback") return false;
  return tryLoadOpenCv() !== null;
}

export async function analyzeFramesForOcr(
  framePaths: string[],
  config: VisionConfig = readVisionConfig()
): Promise<{
  selectedPaths: string[];
  metrics: VisionJobMetrics;
  analyses: FrameAnalysis[];
}> {
  const t0 = Date.now();
  const useOpenCv = resolveUseOpenCv(config);
  /** OpenCV available + enabled for pipeline metrics; Laplacian always uses Sharp (see blur.ts). */
  const openCvLoaded = useOpenCv && tryLoadOpenCv() !== null;

  if (!config.enabled || framePaths.length === 0) {
    const visionMs = Date.now() - t0;
    return {
      selectedPaths: framePaths,
      metrics: {
        framesExtracted: framePaths.length,
        framesSkippedBlur: 0,
        framesSkippedDuplicate: 0,
        framesOcrd: framePaths.length,
        visionEngine: "disabled",
        visionMs,
        ocrMs: 0,
        wouldSkipBlur: 0,
        wouldSkipDuplicate: 0,
      },
      analyses: [],
    };
  }

  const analyses: FrameAnalysis[] = [];
  let prevPath: string | null = null;

  for (let i = 0; i < framePaths.length; i++) {
    const path = framePaths[i];
    const { value: lapVar } = await measureLaplacianVariance(path, useOpenCv);

    const [dhash, { brightness, contrast }, textLikelihood, sceneChangeScore] =
      await Promise.all([
        dhashForFrame(path),
        brightnessContrast(path),
        scoreTextLikelihood(path),
        sceneChangeFromHistogram(prevPath, path),
      ]);

    prevPath = path;

    analyses.push({
      path,
      index: i,
      laplacianVariance: lapVar,
      dhash,
      brightness,
      contrast,
      textLikelihood,
      sceneChangeScore,
      combinedScore: 0,
      skipBlur: false,
      skipDuplicate: false,
    });
  }

  const visionMs = Date.now() - t0;

  const sel = selectFramesForOcr(analyses, config);

  const engine: VisionEngineKind = openCvLoaded ? "opencv" : "fallback";

  return {
    selectedPaths: sel.paths,
    metrics: {
      framesExtracted: framePaths.length,
      framesSkippedBlur: sel.skippedBlur,
      framesSkippedDuplicate: sel.skippedDuplicate,
      framesOcrd: sel.paths.length,
      visionEngine: engine,
      visionMs,
      ocrMs: 0,
      wouldSkipBlur: sel.wouldSkipBlur,
      wouldSkipDuplicate: sel.wouldSkipDuplicate,
    },
    analyses,
  };
}
