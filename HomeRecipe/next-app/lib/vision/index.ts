export { readVisionConfig, withOcrBudget, type VisionConfig } from "./config";
export type { VisionJobMetrics, FrameAnalysis, VisionEngineKind } from "./types";
export { analyzeFramesForOcr } from "./analyzeFrames";
export { maybeCropForOcr, cleanupCropPath } from "./cropTextRegion";
export { tryLoadOpenCv, isOpenCvAvailable } from "./opencv";
export {
  visionJobMetricsToDbJson,
  type VisionMetricsDbJson,
} from "./metricsDb";
export {
  ocrBudgetForDuration,
  visionLlmFrameCountForDuration,
  extractFrameCapForDuration,
} from "./frameBudget";
