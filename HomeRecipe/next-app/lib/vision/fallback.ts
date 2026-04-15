/**
 * Sharp / pure-JS fallbacks when OpenCV native bindings are unavailable.
 */

import sharp from "sharp";

/** Resize width for analysis (fast, comparable across frames) */
const ANALYSIS_WIDTH = 256;

/**
 * Laplacian variance on grayscale (focus measure). Higher = sharper.
 */
export async function laplacianVarianceFromPath(imagePath: string): Promise<number> {
  const { data, info } = await sharp(imagePath)
    .resize({ width: ANALYSIS_WIDTH, withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (w < 3 || h < 3) return 0;

  return laplacianVarianceGrayBuffer(data, w, h);
}

export function laplacianVarianceGrayBuffer(
  data: Buffer | Uint8Array,
  width: number,
  height: number
): number {
  // 3x3 Laplacian kernel (4-center)
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = (y * width + x) as number;
      const v =
        -data[p - width] -
        data[p - 1] +
        4 * data[p] -
        data[p + 1] -
        data[p + width];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Difference hash (dHash) 8x8 = 64 bits, returned as 16-char hex.
 */
export async function computeDhashHex(imagePath: string): Promise<string> {
  const { data, info } = await sharp(imagePath)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const bits: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      bits.push(data[i] > data[i + 1] ? 1 : 0);
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      if (bits[i + j]) {
        n |= 1 << (3 - j);
      }
    }
    hex += n.toString(16);
  }
  return hex.padStart(16, "0");
}

const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingDistanceHex64(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let count = 0;
  for (let i = 0; i < 16; i++) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    count += NIBBLE_POPCOUNT[x ^ y];
  }
  return count;
}

/**
 * Mean brightness 0–255 and contrast (std dev) on small grayscale preview.
 */
export async function brightnessContrast(imagePath: string): Promise<{
  brightness: number;
  contrast: number;
}> {
  const { data } = await sharp(imagePath)
    .resize({ width: 128, withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = data.length ? sum / data.length : 0;
  let varSum = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i] - mean;
    varSum += d * d;
  }
  const contrast = data.length ? Math.sqrt(varSum / data.length) : 0;
  return { brightness: mean, contrast };
}

/**
 * Edge / horizontal-structure heuristic for text overlays (0–1).
 */
export async function edgeTextLikelihood(imagePath: string): Promise<number> {
  const { data, info } = await sharp(imagePath)
    .resize(64, 64, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (w < 3 || h < 3) return 0;

  let gradSum = 0;
  let horiz = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const gx =
        -data[p - 1] + data[p + 1];
      const gy = -data[p - w] + data[p + w];
      const mag = Math.abs(gx) + Math.abs(gy);
      gradSum += mag;
      horiz += Math.abs(gx);
      n++;
    }
  }
  if (n === 0) return 0;
  const ratio = horiz / (gradSum + 1e-6);
  const density = Math.min(1, gradSum / (n * 255));
  return Math.min(1, 0.5 * ratio + 0.5 * density);
}

/**
 * Scene change score vs previous frame histogram (0–1).
 */
export async function sceneChangeFromHistogram(
  prevPath: string | null,
  curPath: string
): Promise<number> {
  if (!prevPath) return 1;

  const hist = async (path: string) => {
    const { data } = await sharp(path)
      .resize(48, 48, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bins = new Array(16).fill(0);
    for (let i = 0; i < data.length; i++) {
      bins[Math.min(15, data[i] >> 4)]++;
    }
    const sum = data.length || 1;
    return bins.map((b) => b / sum);
  };

  const [a, b] = await Promise.all([hist(prevPath), hist(curPath)]);
  let diff = 0;
  for (let i = 0; i < 16; i++) diff += Math.abs(a[i] - b[i]);
  return Math.min(1, diff / 2);
}
