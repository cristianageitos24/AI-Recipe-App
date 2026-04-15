/**
 * Blur detection via Laplacian variance (OpenCV when available, else sharp).
 */

import { tryLoadOpenCv } from "./opencv";
import { laplacianVarianceFromPath } from "./fallback";

function laplacianVarianceOpenCv(imagePath: string): number | null {
  const cv = tryLoadOpenCv() as Record<string, unknown> | null;
  if (!cv) return null;
  try {
    const imread = cv.imread as (p: string) => {
      channels: number;
      cvtColor: (code: number) => unknown;
      laplacian: (ddepth: number) => {
        meanStdDev: () => { stddev: { at: (i: number, j?: number) => number } };
      };
    };
    const mat = imread(imagePath);
    let gray: {
      laplacian: (ddepth: number) => {
        meanStdDev: () => { stddev: { at: (i: number, j?: number) => number } };
      };
    } = mat as unknown as typeof gray;
    if (mat.channels > 1) {
      gray = mat.cvtColor(cv.COLOR_BGR2GRAY as number) as typeof gray;
    }
    const lap = gray.laplacian(cv.CV_64F as number);
    const { stddev } = lap.meanStdDev();
    const s = stddev.at(0, 0) ?? stddev.at(0);
    return s * s;
  } catch {
    return null;
  }
}

export async function measureLaplacianVariance(
  imagePath: string,
  useOpenCv: boolean
): Promise<{ value: number; usedOpenCv: boolean }> {
  if (useOpenCv) {
    const v = laplacianVarianceOpenCv(imagePath);
    if (v !== null && Number.isFinite(v)) {
      return { value: v, usedOpenCv: true };
    }
  }
  const value = await laplacianVarianceFromPath(imagePath);
  return { value, usedOpenCv: false };
}
