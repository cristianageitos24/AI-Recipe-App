import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { unlink } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { createWorker } from "tesseract.js";
import {
  analyzeFramesForOcr,
  readVisionConfig,
  maybeCropForOcr,
  cleanupCropPath,
} from "./vision";
import type { VisionJobMetrics } from "./vision/types";

// Try to use bundled ffmpeg/ffprobe if available, otherwise use system binaries
try {
  const ffmpegStatic = require("ffmpeg-static");
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
  }
} catch {
  // Use system ffmpeg
}

try {
  const ffprobeStatic = require("ffprobe-static");
  if (ffprobeStatic?.path) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
  }
} catch {
  // Use system ffprobe
}

const execAsync = promisify(exec);

export interface OCRProvider {
  ocrFrame(imagePath: string): Promise<string>;
}

/**
 * Native Tesseract CLI implementation (preferred)
 */
class TesseractCLIProvider implements OCRProvider {
  private tesseractPath: string;

  constructor(tesseractPath: string) {
    this.tesseractPath = tesseractPath;
  }

  async ocrFrame(imagePath: string): Promise<string> {
    try {
      // PSM 11: sparse text - finds text in no particular order (better for video overlays)
      const command = `"${this.tesseractPath}" "${imagePath}" stdout -l eng --psm 11`;
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr && !stderr.includes("Warning")) {
        console.warn(`Tesseract CLI warning: ${stderr}`);
      }

      return stdout.trim();
    } catch (error) {
      console.error(`Tesseract CLI error: ${error}`);
      throw error;
    }
  }
}

/**
 * Tesseract.js fallback implementation
 */
class TesseractJSProvider implements OCRProvider {
  private worker: any = null;

  async init() {
    if (!this.worker) {
      this.worker = await createWorker("eng", 1, {
        logger: () => {}, // Suppress logs
      });
      await this.worker.setParameters({ tessedit_pageseg_mode: "11" }); // Sparse text
    }
  }

  async ocrFrame(imagePath: string): Promise<string> {
    await this.init();
    const {
      data: { text },
    } = await this.worker.recognize(imagePath);
    return text.trim();
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Auto-detect and create OCR provider
 */
export async function createOCRProvider(): Promise<OCRProvider> {
  // Check for Tesseract CLI on PATH
  const isWindows = process.platform === "win32";
  const checkCommand = isWindows ? "where tesseract" : "which tesseract";

  try {
    const { stdout } = await execAsync(checkCommand);
    const tesseractPath = stdout.trim().split("\n")[0];
    if (tesseractPath && existsSync(tesseractPath)) {
      console.log(`[OCR] Using Tesseract CLI: ${tesseractPath}`);
      return new TesseractCLIProvider(tesseractPath);
    }
  } catch (error) {
    // CLI not found, fallback to JS
  }

  console.log("[OCR] Tesseract CLI not found, using tesseract.js fallback");
  return new TesseractJSProvider();
}

/**
 * Get video duration in seconds using ffprobe
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get video duration: ${err.message}`));
        return;
      }

      const duration = metadata.format.duration;
      if (typeof duration !== "number" || isNaN(duration)) {
        reject(new Error("Invalid video duration"));
        return;
      }

      resolve(duration);
    });
  });
}

/**
 * Extract a single color frame from video for use as recipe thumbnail/cover.
 * Uses full color (no grayscale). Default time 1s to skip possible black intro.
 * @param videoPath Path to video file
 * @param outputPath Full path for the output PNG file
 * @param timeSeconds Time in seconds (default 1)
 * @returns Path to the written file
 */
export function extractThumbnailFrame(
  videoPath: string,
  outputPath: string,
  timeSeconds: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timeSeconds)
      .outputOptions(["-frames:v", "1"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) =>
        reject(new Error(`Thumbnail extraction failed: ${err.message}`))
      )
      .run();
  });
}

/** Conservative OCR typo fixes for common video OCR noise */
export function applyOcrTypoCorrections(text: string): string {
  let s = text;
  const pairs: [RegExp, string][] = [
    [/\btb5p\b/gi, "tbsp"],
    [/\bt5p\b/gi, "tsp"],
    [/\bmiin\b/gi, "min"],
    [/\b0live\b/gi, "olive"],
    [/\bchiken\b/gi, "chicken"],
  ];
  for (const [re, rep] of pairs) {
    s = s.replace(re, rep);
  }
  return s;
}

/**
 * Extract frames from video
 * @param videoPath Path to video file
 * @param outputDir Directory to save frames
 * @param maxFrames Maximum number of frames to extract (default: 60)
 * @returns Array of frame file paths
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  maxFrames: number = 60
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const framePaths: string[] = [];
    let frameCount = 0;

    ffmpeg(videoPath)
      .outputOptions([
        "-vf",
        // OCR-optimized: 1fps, 2x scale, grayscale, contrast, light sharpen for text
        "fps=1,scale=iw*2:ih*2,format=gray,eq=contrast=1.2:brightness=0.02,unsharp=5:5:0.5:5:5:0",
        "-frames:v",
        maxFrames.toString(), // Limit frames
      ])
      .output(join(outputDir, "frame-%03d.png"))
      .on("end", () => {
        // Collect all frame files
        const fs = require("fs");
        const files = fs.readdirSync(outputDir);
        const frameFiles = files
          .filter((f: string) => f.startsWith("frame-") && f.endsWith(".png"))
          .sort()
          .map((f: string) => join(outputDir, f));

        resolve(frameFiles);
      })
      .on("error", (err) => {
        reject(new Error(`Frame extraction failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Normalize a line of text for deduplication
 */
function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Check if line should be filtered out (TikTok junk, etc.)
 */
function shouldFilterLine(line: string): boolean {
  const normalized = line.toLowerCase();
  const junkPatterns = [
    /^(like|share|follow|subscribe|comment|save)/i,
    /^(tap|click|swipe)/i,
    /^@\w+/, // @mentions
    /^#\w+/, // Hashtags
    /save for when you need it/i,
    /^tiktok$/i,
    /@\s*foodieshares/i,
    /foodieshare/i, // common typo
    /^cancel$/i,
    /^on timer$/i,
    /^broil\s*start/i,
    /^\d+\s*[:\/]\s*\d+$/, // time overlays like "3:45"
    /^\d+\s*%\s*$/, // "1%", "2%" etc
  ];

  // Check for junk patterns
  if (junkPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  // Filter lines with mostly symbols (> 50% non-alphanumeric)
  const symbolCount = (line.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const totalChars = line.replace(/\s/g, "").length;
  if (totalChars > 0 && symbolCount / totalChars > 0.5) {
    return true;
  }

  // Filter lines where longest word is < 3 chars (e.g. "a e", "x .")
  const words = line.split(/\s+/).filter((w) => w.length > 0);
  const maxWordLen = words.length > 0 ? Math.max(...words.map((w) => w.length)) : 0;
  if (maxWordLen < 3) {
    return true;
  }

  // Filter lines with > 70% non-alpha (garbage ratio)
  const alphaCount = (line.match(/[a-zA-Z]/g) || []).length;
  if (totalChars > 0 && alphaCount / totalChars < 0.3) {
    return true;
  }

  return false;
}

/**
 * Clean and deduplicate OCR text
 */
export function cleanAndDeduplicateOCRText(text: string): string {
  const lines = text.split("\n");
  const seen = new Map<string, string>(); // normalized key → original line

  for (const line of lines) {
    const normalized = normalizeLine(line);

    // Filter short lines
    if (normalized.length < 3) {
      continue;
    }

    // Filter junk lines
    if (shouldFilterLine(normalized)) {
      continue;
    }

    // Case-insensitive deduplication
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, line.trim()); // Preserve original formatting
    }
  }

  return Array.from(seen.values()).join("\n");
}

export type VideoFrameProgressPayload = {
  frameIndex: number;
  frameCount: number;
};

export type ProcessVideoResult = {
  ocrText: string;
  metrics: VisionJobMetrics;
};

/**
 * Process video: extract frames, vision analysis, optional crop, OCR, cleanup.
 */
export async function processVideo(
  videoPath: string,
  ocrProvider: OCRProvider,
  maxFrames: number = 60,
  onFrameProgress?: (
    payload: VideoFrameProgressPayload
  ) => void | Promise<void>
): Promise<ProcessVideoResult> {
  const tempDir = join(tmpdir(), `video-ocr-${Date.now()}`);
  const fs = require("fs");
  fs.mkdirSync(tempDir, { recursive: true });

  const visionConfig = readVisionConfig();

  try {
    const framePaths = await extractFrames(videoPath, tempDir, maxFrames);
    console.log(`[Processing] Extracted ${framePaths.length} frames`);

    const { selectedPaths, metrics: visionMetrics } =
      await analyzeFramesForOcr(framePaths, visionConfig);

    const ocrStarted = Date.now();
    const allText: string[] = [];

    for (let i = 0; i < selectedPaths.length; i++) {
      const framePath = selectedPaths[i];
      let ocrPath = framePath;
      try {
        ocrPath = await maybeCropForOcr(
          framePath,
          visionConfig.cropTextRegions,
          tempDir
        );
        const text = await ocrProvider.ocrFrame(ocrPath);
        if (text) {
          allText.push(text);
        }
        console.log(
          `[Processing] OCR ${i + 1}/${selectedPaths.length} (vision-selected)`
        );
      } catch (error) {
        console.error(`[Processing] Error processing frame ${framePath}:`, error);
      } finally {
        await cleanupCropPath(framePath, ocrPath);
      }
      await Promise.resolve(
        onFrameProgress?.({
          frameIndex: i,
          frameCount: selectedPaths.length,
        })
      );
    }

    const ocrMs = Date.now() - ocrStarted;
    const combinedText = allText.join("\n");
    const deduped = cleanAndDeduplicateOCRText(combinedText);
    const cleanedText = applyOcrTypoCorrections(deduped);

    const metrics: VisionJobMetrics = {
      ...visionMetrics,
      ocrMs,
      framesOcrd: selectedPaths.length,
    };

    return { ocrText: cleanedText, metrics };
  } finally {
    // Cleanup temp directory
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        await unlink(join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch (error) {
      console.error(`[Processing] Error cleaning up temp directory:`, error);
    }
  }
}

/**
 * Enforce timeout on a promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}
