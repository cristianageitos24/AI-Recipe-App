/**
 * Lazy load @u4/opencv4nodejs (optional dependency; present in Docker worker).
 * Do not import from client or Next.js edge bundles.
 */

export type CvModule = {
  imread: (path: string) => unknown;
  COLOR_BGR2GRAY: number;
  COLOR_BGRA2GRAY: number;
  CV_64F: number;
  Laplacian: (
    src: unknown,
    dst: unknown,
    ddepth: number,
    ksize?: number,
    scale?: number,
    delta?: number,
    borderMode?: number
  ) => void;
  Mat: new (...args: unknown[]) => unknown;
  meanStdDev: (
    src: unknown,
    mask?: unknown
  ) => { mean: unknown; stddev: unknown };
};

let cachedCv: CvModule | null | undefined;

/**
 * Returns OpenCV module if installed and loadable; otherwise null.
 */
export function tryLoadOpenCv(): CvModule | null {
  if (cachedCv !== undefined) {
    return cachedCv;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cv = require("@u4/opencv4nodejs") as CvModule;
    if (cv && typeof cv.imread === "function") {
      cachedCv = cv;
      return cachedCv;
    }
    cachedCv = null;
    return null;
  } catch {
    cachedCv = null;
    return null;
  }
}

export function isOpenCvAvailable(): boolean {
  return tryLoadOpenCv() !== null;
}
