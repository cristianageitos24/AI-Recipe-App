/**
 * Optional crop to high-activity region before OCR (sharp-only; works everywhere).
 */

import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

/**
 * If enabled, writes a cropped PNG in tempDir and returns its path; otherwise returns input path.
 */
export async function maybeCropForOcr(
  imagePath: string,
  enabled: boolean,
  tempDir: string
): Promise<string> {
  if (!enabled) return imagePath;

  const { data, info } = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (w < 16 || h < 16) return imagePath;

  const rowEnergy = new Array(h).fill(0);
  const colEnergy = new Array(w).fill(0);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const e =
        Math.abs(data[p] - data[p - 1]) + Math.abs(data[p] - data[p - w]);
      rowEnergy[y] += e;
      colEnergy[x] += e;
    }
  }

  const meanE =
    rowEnergy.reduce((a, b) => a + b, 0) / (h + w);
  const thresh = Math.max(8, meanE * 0.35);

  let top = 0;
  while (top < h && rowEnergy[top] < thresh) top++;
  let bottom = h - 1;
  while (bottom > top && rowEnergy[bottom] < thresh) bottom--;

  let left = 0;
  while (left < w && colEnergy[left] < thresh) left++;
  let right = w - 1;
  while (right > left && colEnergy[right] < thresh) right--;

  if (right - left < 40 || bottom - top < 40) return imagePath;

  const pad = 8;
  const outPath = join(
    tempDir,
    `crop-${Date.now()}-${Math.random().toString(36).slice(2)}.png`
  );
  await mkdir(tempDir, { recursive: true });
  await sharp(imagePath)
    .extract({
      left: Math.max(0, left - pad),
      top: Math.max(0, top - pad),
      width: Math.min(w, right - left + 2 * pad),
      height: Math.min(h, bottom - top + 2 * pad),
    })
    .png()
    .toFile(outPath);

  return outPath;
}

export async function cleanupCropPath(
  originalPath: string,
  maybeCrop: string
): Promise<void> {
  if (maybeCrop === originalPath) return;
  try {
    await unlink(maybeCrop);
  } catch {
    /* ignore */
  }
}
