/**
 * Blur detection via Laplacian variance.
 *
 * The default threshold in config (minLaplacianVariance) is tuned for the Sharp pipeline
 * (resize to fixed width, grayscale, discrete Laplacian). OpenCV full-frame Laplacian
 * variance is not on the same numeric scale; using it caused almost every frame to read
 * as "blurry". We always use Sharp here so thresholds stay meaningful; OpenCV remains
 * available elsewhere in the app (e.g. optional future steps).
 */

import { laplacianVarianceFromPath } from "./fallback";

export async function measureLaplacianVariance(
  imagePath: string,
  _useOpenCv: boolean
): Promise<{ value: number; usedOpenCv: boolean }> {
  const value = await laplacianVarianceFromPath(imagePath);
  return { value, usedOpenCv: false };
}
