/**
 * Shared types for the vision pipeline (blur, duplicates, frame selection).
 */

export type VisionEngineKind = "opencv" | "fallback" | "disabled";

export type VisionJobMetrics = {
  framesExtracted: number;
  framesSkippedBlur: number;
  framesSkippedDuplicate: number;
  framesOcrd: number;
  visionEngine: VisionEngineKind;
  visionMs: number;
  ocrMs: number;
  /** When metrics-only mode: counts that would have been skipped */
  wouldSkipBlur: number;
  wouldSkipDuplicate: number;
  /** Multimodal vision LLM (optional) */
  visionLlmEnabled?: boolean;
  visionLlmFrames?: number;
  visionLlmMs?: number;
  visionLlmIngredientCount?: number;
  visionLlmModel?: string | null;
  ocrBudget?: number;
};

export type FrameAnalysis = {
  path: string;
  index: number;
  laplacianVariance: number;
  /** dHash as 64-bit hex string (16 chars) */
  dhash: string;
  brightness: number;
  contrast: number;
  textLikelihood: number;
  sceneChangeScore: number;
  combinedScore: number;
  skipBlur: boolean;
  skipDuplicate: boolean;
};
