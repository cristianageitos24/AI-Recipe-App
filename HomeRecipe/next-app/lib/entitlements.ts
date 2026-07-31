import { isProSubscriptionStatus } from "@/lib/stripe";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import {
  FREE_EXTRACTION_LIMIT,
  FREE_RECIPE_TTL_DAYS,
  FREE_RESTORE_GRACE_DAYS,
  type PlanLimitReason,
} from "@/lib/entitlements-constants";

export {
  FREE_EXTRACTION_LIMIT,
  FREE_RECIPE_TTL_DAYS,
  FREE_RESTORE_GRACE_DAYS,
  type PlanLimitReason,
} from "@/lib/entitlements-constants";

export type PlanLimitError = {
  code: "PLAN_LIMIT";
  reason: PlanLimitReason;
  error: string;
};

export type UserEntitlements = {
  isPro: boolean;
  extractionsUsed: number;
  extractionsLimit: number;
  extractionsRemaining: number;
  recipeTtlDays: number;
};

type ProfileEntitlementFields = {
  plan_tier: "free" | "pro";
  stripe_subscription_status: string | null;
};

const PLAN_LIMIT_MESSAGES: Record<PlanLimitReason, string> = {
  catalog: "Upgrade to Pro to unlock the full recipe library",
  nutrition: "Upgrade to Pro to unlock full nutrients and macros",
  extractions: "You've used your free extractions this month",
  expiry: "This recipe expired — upgrade to keep recipes forever",
  planning: "Upgrade to Pro to unlock meal planning and grocery lists",
};

export function planLimitError(reason: PlanLimitReason): PlanLimitError {
  return {
    code: "PLAN_LIMIT",
    reason,
    error: PLAN_LIMIT_MESSAGES[reason],
  };
}

export function isUserProFromProfile(
  profile: ProfileEntitlementFields | null
): boolean {
  if (!profile) return false;
  return (
    profile.plan_tier === "pro" ||
    isProSubscriptionStatus(profile.stripe_subscription_status)
  );
}

async function getProfileEntitlementFields(
  userId: string
): Promise<ProfileEntitlementFields | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_tier, stripe_subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileEntitlementFields:", error.message);
    return null;
  }
  return data as ProfileEntitlementFields | null;
}

export async function isUserPro(userId: string): Promise<boolean> {
  const profile = await getProfileEntitlementFields(userId);
  return isUserProFromProfile(profile);
}

function currentYearMonthUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getExtractionUsage(userId: string): Promise<number> {
  const svc = await createServiceRoleClient();
  const yearMonth = currentYearMonthUtc();
  const { data, error } = await svc
    .from("extraction_usage_monthly")
    .select("count")
    .eq("user_id", userId)
    .eq("year_month", yearMonth)
    .maybeSingle();

  if (error) {
    console.error("getExtractionUsage:", error.message);
    return 0;
  }
  return typeof data?.count === "number" ? data.count : 0;
}

export async function getEntitlements(
  userId: string
): Promise<UserEntitlements> {
  const profile = await getProfileEntitlementFields(userId);
  const isPro = isUserProFromProfile(profile);
  const extractionsUsed = isPro ? 0 : await getExtractionUsage(userId);

  return {
    isPro,
    extractionsUsed: isPro ? 0 : extractionsUsed,
    extractionsLimit: FREE_EXTRACTION_LIMIT,
    extractionsRemaining: isPro
      ? FREE_EXTRACTION_LIMIT
      : Math.max(0, FREE_EXTRACTION_LIMIT - extractionsUsed),
    recipeTtlDays: FREE_RECIPE_TTL_DAYS,
  };
}

/** Client-safe entitlements (finite numbers for JSON). */
export async function getEntitlementsForClient(userId: string): Promise<{
  isPro: boolean;
  extractionsUsed: number;
  extractionsLimit: number;
  extractionsRemaining: number;
  recipeTtlDays: number;
}> {
  return getEntitlements(userId);
}

/**
 * Pro: always ok. Free: atomically consume one monthly extraction.
 * Returns plan limit error when over quota.
 */
export async function assertCanExtract(
  userId: string
): Promise<{ ok: true } | { ok: false; limit: PlanLimitError }> {
  if (await isUserPro(userId)) {
    return { ok: true };
  }

  const svc = await createServiceRoleClient();
  const { data, error } = await svc.rpc("consume_extraction_quota", {
    p_user_id: userId,
    p_limit: FREE_EXTRACTION_LIMIT,
  });

  if (error) {
    console.error("assertCanExtract rpc:", error.message);
    return { ok: false, limit: planLimitError("extractions") };
  }

  if (data !== true) {
    return { ok: false, limit: planLimitError("extractions") };
  }

  return { ok: true };
}

export type RecipeAccessRow = {
  user_id?: string | null;
  expires_at?: string | null;
  deleted_at?: string | null;
};

export async function assertCanOpenRecipe(
  userId: string,
  recipe: RecipeAccessRow
): Promise<
  | { ok: true }
  | { ok: false; limit: PlanLimitError }
  | { ok: false; forbidden: true }
> {
  const isPro = await isUserPro(userId);
  const ownerId = recipe.user_id ?? null;
  const isShared = ownerId == null;
  const isOwn = ownerId === userId;

  if (!isShared && !isOwn) {
    return { ok: false, forbidden: true };
  }

  if (isShared) {
    if (!isPro) return { ok: false, limit: planLimitError("catalog") };
    return { ok: true };
  }

  if (recipe.expires_at) {
    const exp = Date.parse(recipe.expires_at);
    if (Number.isFinite(exp) && exp < Date.now()) {
      return { ok: false, limit: planLimitError("expiry") };
    }
  }

  return { ok: true };
}

export function freeRecipeExpiresAtIso(from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + FREE_RECIPE_TTL_DAYS);
  return d.toISOString();
}

export function restoreGraceExpiresAtIso(from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + FREE_RESTORE_GRACE_DAYS);
  return d.toISOString();
}

/** Clear expiry on all owned recipes (Pro upgrade). */
export async function clearRecipeExpiry(userId: string): Promise<void> {
  const svc = await createServiceRoleClient();
  const { error } = await svc
    .from("recipes")
    .update({ expires_at: null })
    .eq("user_id", userId)
    .not("expires_at", "is", null);

  if (error) {
    console.error("clearRecipeExpiry:", error.message);
    throw error;
  }
}

/**
 * Stamp +30d expiry on owned recipes that currently have no expiry
 * (downgrade / cancel / past_due).
 */
export async function stampFreeRecipeExpiry(userId: string): Promise<void> {
  const svc = await createServiceRoleClient();
  const expiresAt = freeRecipeExpiresAtIso();
  const { error } = await svc
    .from("recipes")
    .update({ expires_at: expiresAt })
    .eq("user_id", userId)
    .is("expires_at", null)
    .is("deleted_at", null);

  if (error) {
    console.error("stampFreeRecipeExpiry:", error.message);
    throw error;
  }
}

export async function resolveClerkUserIdFromStripeCustomer(
  customerId: string
): Promise<string | null> {
  const svc = await createServiceRoleClient();
  const { data, error } = await svc
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("resolveClerkUserIdFromStripeCustomer:", error.message);
    return null;
  }
  return data?.id ?? null;
}
