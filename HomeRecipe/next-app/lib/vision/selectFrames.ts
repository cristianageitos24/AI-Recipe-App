/**
 * Choose which frame paths to send to OCR given analysis + config.
 */

import type { VisionConfig } from "./config";
import type { FrameAnalysis } from "./types";
import { attachCombinedScore } from "./frameScore";
import { isDuplicatePair } from "./duplicates";

export type SelectionResult = {
  paths: string[];
  skippedBlur: number;
  skippedDuplicate: number;
  wouldSkipBlur: number;
  wouldSkipDuplicate: number;
};

function byIndex(a: FrameAnalysis, b: FrameAnalysis): number {
  return a.index - b.index;
}

/**
 * Smart selection: top combined scores with timeline diversity (bucket picks).
 */
function smartSelect(
  frames: FrameAnalysis[],
  maxOcr: number,
  minOcr: number
): FrameAnalysis[] {
  if (frames.length <= maxOcr) return frames;

  const n = frames.length;
  const buckets = Math.min(12, Math.max(4, Math.ceil(n / 4)));
  const maxIdx = Math.max(0, ...frames.map((f) => f.index));
  const timelineSpan = maxIdx + 1;
  const byBucket: FrameAnalysis[][] = Array.from({ length: buckets }, () => []);

  const sorted = [...frames].sort((a, b) => b.combinedScore - a.combinedScore);
  for (const f of sorted) {
    const b = Math.min(
      buckets - 1,
      Math.floor((f.index / Math.max(1, timelineSpan)) * buckets)
    );
    byBucket[b].push(f);
  }

  const picked: FrameAnalysis[] = [];
  const seen = new Set<string>();
  for (const list of byBucket) {
    list.sort((a, b) => b.combinedScore - a.combinedScore);
    for (const f of list) {
      if (picked.length >= maxOcr) break;
      if (!seen.has(f.path)) {
        seen.add(f.path);
        picked.push(f);
      }
    }
  }

  if (picked.length < minOcr) {
    for (const f of sorted) {
      if (picked.length >= minOcr) break;
      if (!seen.has(f.path)) {
        seen.add(f.path);
        picked.push(f);
      }
    }
  }

  picked.sort(byIndex);
  return picked;
}

export function selectFramesForOcr(
  rawFrames: FrameAnalysis[],
  config: VisionConfig
): SelectionResult {
  const frames = rawFrames.map((f) => attachCombinedScore(f)).sort(byIndex);

  let wouldSkipBlur = 0;
  let wouldSkipDuplicate = 0;

  let lastUniqueHash: string | null = null;
  const withDup: FrameAnalysis[] = [];

  const keepBlurryAt = config.keepBlurryMinTextLikelihood ?? 0.35;

  for (const f of frames) {
    const rawBlurFail = f.laplacianVariance < config.minLaplacianVariance;
    // Accuracy-first: keep texty frames even if Laplacian says blurry (ingredient overlays)
    const blurFail =
      rawBlurFail && !(f.textLikelihood >= keepBlurryAt);
    if (blurFail) wouldSkipBlur++;

    let dupFail = false;
    if (lastUniqueHash !== null) {
      if (isDuplicatePair(f.dhash, lastUniqueHash, config.duplicateMaxHamming)) {
        dupFail = true;
        wouldSkipDuplicate++;
      }
    }
    if (!dupFail) {
      lastUniqueHash = f.dhash;
    }

    withDup.push({
      ...f,
      skipBlur: blurFail,
      skipDuplicate: dupFail,
    });
  }

  if (config.metricsOnly) {
    return {
      paths: frames.map((f) => f.path),
      skippedBlur: 0,
      skippedDuplicate: 0,
      wouldSkipBlur,
      wouldSkipDuplicate,
    };
  }

  let candidates = withDup.filter((f) => {
    if (config.skipBlur && f.skipBlur) return false;
    if (config.skipDuplicate && f.skipDuplicate) return false;
    return true;
  });

  if (candidates.length < config.minOcrFrames) {
    const need = config.minOcrFrames - candidates.length;
    const have = new Set(candidates.map((c) => c.path));
    const extras = [...withDup]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .filter((f) => !have.has(f.path))
      .slice(0, need);
    candidates = [...candidates, ...extras].sort(byIndex);
  }

  const skippedBlur = withDup.filter((f) => f.skipBlur && config.skipBlur).length;
  const skippedDup = withDup.filter(
    (f) => f.skipDuplicate && config.skipDuplicate
  ).length;

  if (config.selectMode === "smart" && candidates.length > config.maxOcrFrames) {
    candidates = smartSelect(candidates, config.maxOcrFrames, config.minOcrFrames);
  }

  return {
    paths: candidates.map((f) => f.path),
    skippedBlur,
    skippedDuplicate: skippedDup,
    wouldSkipBlur,
    wouldSkipDuplicate,
  };
}
