import sharp from "sharp";

export type CompressedImage = {
  buffer: Buffer;
  contentType: string;
  /** Original byte length before compression (or same if unchanged). */
  originalBytes: number;
};

/**
 * Lossless image recompression for storage savings.
 * Keeps pixels identical; only tightens encoding (and applies EXIF orientation).
 * Returns the original buffer when compression would not shrink the file.
 */
export async function compressImageLossless(
  input: Buffer,
  preferredContentType?: string
): Promise<CompressedImage> {
  const originalBytes = input.length;
  const pngBuf = await sharp(input)
    .rotate()
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  if (pngBuf.length < originalBytes) {
    return {
      buffer: pngBuf,
      contentType: "image/png",
      originalBytes,
    };
  }

  return {
    buffer: input,
    contentType: preferredContentType || "image/png",
    originalBytes,
  };
}
