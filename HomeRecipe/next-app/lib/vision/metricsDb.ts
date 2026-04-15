/**
 * Serialize vision metrics for video_processing_jobs.vision_metrics (JSONB).
 * Uses snake_case keys so SQL filters and dashboards stay readable.
 */

import type { VisionJobMetrics } from "./types";

export type VisionMetricsDbJson = {
  frames_extracted: number;
  frames_skipped_blur: number;
  frames_skipped_duplicate: number;
  frames_ocrd: number;
  vision_engine: string;
  vision_ms: number;
  ocr_ms: number;
  would_skip_blur: number;
  would_skip_duplicate: number;
};

export function visionJobMetricsToDbJson(
  m: VisionJobMetrics
): VisionMetricsDbJson {
  return {
    frames_extracted: m.framesExtracted,
    frames_skipped_blur: m.framesSkippedBlur,
    frames_skipped_duplicate: m.framesSkippedDuplicate,
    frames_ocrd: m.framesOcrd,
    vision_engine: m.visionEngine,
    vision_ms: m.visionMs,
    ocr_ms: m.ocrMs,
    would_skip_blur: m.wouldSkipBlur,
    would_skip_duplicate: m.wouldSkipDuplicate,
  };
}
