import {
  FREE_EXTRACTION_LIMIT,
  FREE_RECIPE_TTL_DAYS,
} from "@/lib/entitlements-constants";

/** Display prices — keep in sync with UpgradePrompt / Billing CTAs. */
export const PLAN_PRICE_FREE = "$0";
export const PLAN_PRICE_PRO_MONTHLY = "$1.99";
export const PLAN_PRICE_PRO_YEARLY = "$20";

export type PlanFeatureValue = boolean | string;

export type PlanFeature = {
  id: string;
  /** Short label used in compare rows */
  label: string;
  free: PlanFeatureValue;
  pro: PlanFeatureValue;
};

/**
 * Canonical Free vs Pro matrix for UpgradePrompt and Billing.
 * Limits come from entitlements-constants so copy stays in sync with gates.
 */
export const PLAN_FEATURES: PlanFeature[] = [
  {
    id: "extractions",
    label: `${FREE_EXTRACTION_LIMIT} URL/video extractions per month`,
    free: true,
    pro: "Unlimited extractions",
  },
  {
    id: "owned-recipes",
    label: `Your own recipes (expire after ${FREE_RECIPE_TTL_DAYS} days)`,
    free: true,
    pro: "Recipes never expire",
  },
  {
    id: "cookbooks",
    label: "Cookbooks for your recipes",
    free: true,
    pro: true,
  },
  {
    id: "library",
    label: "Full Recipe Library + collections",
    free: false,
    pro: true,
  },
  {
    id: "web-search",
    label: "Web search",
    free: false,
    pro: true,
  },
  {
    id: "nutrition",
    label: "Full nutrients & macros",
    free: false,
    pro: true,
  },
  {
    id: "planning",
    label: "Meal Calendar & Grocery List",
    free: false,
    pro: true,
  },
];

export function featureRowLabel(
  feature: PlanFeature,
  tier: "free" | "pro"
): string {
  const value = feature[tier];
  if (typeof value === "string") return value;
  return feature.label;
}

export function featureIncluded(
  feature: PlanFeature,
  tier: "free" | "pro"
): boolean {
  const value = feature[tier];
  if (typeof value === "boolean") return value;
  return true;
}
