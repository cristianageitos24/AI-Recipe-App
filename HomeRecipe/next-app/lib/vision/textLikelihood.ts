/**
 * Heuristic score for frames likely to contain on-screen text (0–1).
 */

import { edgeTextLikelihood } from "./fallback";

export async function scoreTextLikelihood(imagePath: string): Promise<number> {
  return edgeTextLikelihood(imagePath);
}
