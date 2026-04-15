/**
 * Perceptual duplicate detection via dHash (sharp; consistent across engines).
 */

import { computeDhashHex, hammingDistanceHex64 } from "./fallback";

export async function dhashForFrame(imagePath: string): Promise<string> {
  return computeDhashHex(imagePath);
}

export function isDuplicatePair(
  hashA: string,
  hashB: string,
  maxHamming: number
): boolean {
  return hammingDistanceHex64(hashA, hashB) <= maxHamming;
}
