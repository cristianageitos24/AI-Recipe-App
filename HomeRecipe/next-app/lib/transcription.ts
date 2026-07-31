/**
 * Audio transcription using ffmpeg + OpenAI Whisper
 * Extracts audio from video and transcribes speech-to-text
 */

import ffmpeg from "@modernized/fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import OpenAI, { toFile } from "openai";
import { withTimeout } from "./video-processing";

// Use same ffmpeg path as video-processing (bundled or system)
try {
  const ffmpegStatic = require("ffmpeg-static");
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
  }
} catch {
  // Use system ffmpeg
}

/**
 * Extract audio from video to WAV (mono, 16 kHz, PCM s16le)
 * Optimized for Whisper API
 */
export async function extractAudioToWav(
  videoPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .run();
  });
}

/**
 * Transcribe WAV file using OpenAI Whisper API
 * @param wavPath Path to WAV file
 * @param apiKey OpenAI API key
 * @param timeoutMs Optional timeout; if not provided, no timeout
 */
export async function transcribeWithWhisper(
  wavPath: string,
  apiKey: string,
  timeoutMs?: number
): Promise<string> {
  const buffer = await fs.readFile(wavPath);
  const openai = new OpenAI({ apiKey });

  const transcriptionPromise = (async () => {
    const file = await toFile(buffer, path.basename(wavPath));
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return result.text ?? "";
  })();

  if (timeoutMs != null && timeoutMs > 0) {
    return withTimeout(
      transcriptionPromise,
      timeoutMs,
      `Transcription exceeded timeout of ${timeoutMs}ms`
    );
  }

  return transcriptionPromise;
}
