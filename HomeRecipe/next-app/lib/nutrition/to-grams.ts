/**
 * Deterministic mass (g) for an ingredient line. Returns null when mass cannot be estimated.
 */

const ML_PER_CUP = 236.588;
const ML_PER_TBSP = 14.7868;
const ML_PER_TSP = 4.92892;
const ML_PER_FLOZ = 29.5735;

/** g/ml heuristic from item keywords (Phase B — small static table). */
function densityGPerMl(itemLower: string): number {
  if (/\b(oil|olive|sesame|vegetable oil|coconut oil|canola)\b/.test(itemLower)) {
    return 0.92;
  }
  if (/\b(butter|margarine)\b/.test(itemLower)) return 0.911;
  if (/\b(honey|syrup|molasses|maple)\b/.test(itemLower)) return 1.4;
  if (/\b(milk|cream|buttermilk)\b/.test(itemLower)) return 1.03;
  if (/\b(water|juice|stock|broth|vinegar|wine|beer)\b/.test(itemLower)) {
    return 1.0;
  }
  if (/\b(flour|cornstarch|starch)\b/.test(itemLower)) return 0.53;
  if (/\b(sugar|sucrose)\b/.test(itemLower)) return 0.85;
  if (/\b(salt)\b/.test(itemLower)) return 1.2;
  return 1.0;
}

/** Approximate grams for one "cup" of a dry/wet ingredient by keyword. */
function gramsPerCupHeuristic(itemLower: string): number | null {
  if (/\b(flour|all[- ]purpose)\b/.test(itemLower)) return 125;
  if (/\b(sugar|granulated)\b/.test(itemLower)) return 200;
  if (/\b(brown sugar)\b/.test(itemLower)) return 220;
  if (/\b(butter)\b/.test(itemLower)) return 227;
  if (/\b(oats)\b/.test(itemLower)) return 80;
  if (/\b(rice)\b/.test(itemLower)) return 185;
  return null;
}

export function estimateGrams(params: {
  quantity: number | null;
  unit: string | null;
  item: string;
}): number | null {
  const { quantity, unit, item } = params;
  const itemLower = item.toLowerCase();
  const q = quantity;

  if (q == null || !Number.isFinite(q) || q <= 0) {
    return null;
  }

  if (!unit) {
    return null;
  }

  switch (unit) {
    case "g":
      return q;
    case "kg":
      return q * 1000;
    case "oz":
      return q * 28.3495;
    case "lb":
      return q * 453.592;
    case "ml":
      return q * densityGPerMl(itemLower);
    case "l":
      return q * 1000 * densityGPerMl(itemLower);
    case "cup": {
      const perCup = gramsPerCupHeuristic(itemLower);
      if (perCup != null) return q * perCup;
      const ml = q * ML_PER_CUP;
      return ml * densityGPerMl(itemLower);
    }
    case "tbsp": {
      const ml = q * ML_PER_TBSP;
      return ml * densityGPerMl(itemLower);
    }
    case "tsp": {
      const ml = q * ML_PER_TSP;
      return ml * densityGPerMl(itemLower);
    }
    case "fl_oz": {
      const ml = q * ML_PER_FLOZ;
      return ml * densityGPerMl(itemLower);
    }
    case "whole":
      if (/\begg\b/.test(itemLower)) return q * 50;
      return null;
    case "clove":
      if (/\bgarlic\b/.test(itemLower)) return q * 3;
      return null;
    case "slice":
      return null;
    case "pinch":
    case "dash":
      return q * 0.3;
    case "can":
      return null;
    case "bunch":
    case "stalk":
      return null;
    default:
      return null;
  }
}
