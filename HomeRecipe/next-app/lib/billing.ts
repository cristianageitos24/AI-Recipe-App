import { currentUser } from "@clerk/nextjs/server";
import type Stripe from "stripe";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { ensureProfile } from "@/app/actions/profiles";
import {
  clearRecipeExpiry,
  resolveClerkUserIdFromStripeCustomer,
  stampFreeRecipeExpiry,
} from "@/lib/entitlements";
import {
  getStripe,
  isProSubscriptionStatus,
} from "@/lib/stripe";

export type BillingSource = "stripe" | "apple" | null;

export type ProfileBilling = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_price_id: string | null;
  plan_tier: "free" | "pro";
  billing_source: BillingSource;
  apple_entitlement_active: boolean;
};

/** Shared Pro gate: Stripe active/trialing OR Apple entitlement active. */
export function recomputePlanFields({
  stripeStatus,
  appleActive,
}: {
  stripeStatus: string | null | undefined;
  appleActive: boolean;
}): {
  plan_tier: "free" | "pro";
  billing_source: BillingSource;
} {
  const stripeActive = isProSubscriptionStatus(stripeStatus);
  const plan_tier: "free" | "pro" =
    stripeActive || appleActive ? "pro" : "free";

  let billing_source: BillingSource = null;
  if (stripeActive) {
    billing_source = "stripe";
  } else if (appleActive) {
    billing_source = "apple";
  }

  return { plan_tier, billing_source };
}

export async function getProfileBilling(
  userId: string
): Promise<ProfileBilling | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, plan_tier, billing_source, apple_entitlement_active"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileBilling:", error.message);
    return null;
  }
  return data as ProfileBilling | null;
}

/** Ensure a Stripe Customer exists for the signed-in Clerk user and persist cus_ id. */
export async function ensureStripeCustomer(): Promise<{
  customerId: string;
  userId: string;
  email: string;
}> {
  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await ensureProfile();

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("User email is required for billing");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return {
      customerId: profile.stripe_customer_id,
      userId: user.id,
      email,
    };
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: user.fullName ?? user.username ?? undefined,
    metadata: {
      clerk_user_id: user.id,
    },
  });

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to save stripe_customer_id:", error.message);
    throw new Error("Could not save Stripe customer");
  }

  return { customerId: customer.id, userId: user.id, email };
}

export function planTierFromSubscription(
  subscription: Stripe.Subscription
): {
  plan_tier: "free" | "pro";
  stripe_subscription_status: string;
  stripe_price_id: string | null;
  stripe_subscription_id: string;
} {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const status = subscription.status;
  const active = isProSubscriptionStatus(status);

  return {
    plan_tier: active ? "pro" : "free",
    stripe_subscription_status: status,
    stripe_price_id: priceId,
    stripe_subscription_id: subscription.id,
  };
}

/** Webhook-safe profile update by Stripe customer id (bypasses RLS). */
export async function syncProfileFromSubscription(
  customerId: string,
  subscription: Stripe.Subscription,
  clerkUserId?: string | null
): Promise<void> {
  const supabase = await createServiceRoleClient();
  const stripeFields = planTierFromSubscription(subscription);

  const resolvedUserId =
    clerkUserId ||
    (await resolveClerkUserIdFromStripeCustomer(customerId));

  // Preserve Apple entitlement when recomputing shared plan_tier / billing_source
  let appleActive = false;
  if (resolvedUserId) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("apple_entitlement_active")
      .eq("id", resolvedUserId)
      .maybeSingle();
    appleActive = Boolean(existing?.apple_entitlement_active);
  } else {
    const { data: existing } = await supabase
      .from("profiles")
      .select("apple_entitlement_active")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    appleActive = Boolean(existing?.apple_entitlement_active);
  }

  const recomputed = recomputePlanFields({
    stripeStatus: stripeFields.stripe_subscription_status,
    appleActive,
  });

  const patch = {
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeFields.stripe_subscription_id,
    stripe_subscription_status: stripeFields.stripe_subscription_status,
    stripe_price_id: stripeFields.stripe_price_id,
    plan_tier: recomputed.plan_tier,
    billing_source: recomputed.billing_source,
  };

  if (clerkUserId) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", clerkUserId);
    if (error) {
      console.error("syncProfileFromSubscription (clerk):", error.message);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("stripe_customer_id", customerId);
    if (error) {
      console.error("syncProfileFromSubscription (customer):", error.message);
      throw error;
    }
  }

  if (!resolvedUserId) return;

  if (recomputed.plan_tier === "pro") {
    await clearRecipeExpiry(resolvedUserId);
  } else {
    await stampFreeRecipeExpiry(resolvedUserId);
  }
}

/**
 * Stripe cancel / deletion: clear Stripe Pro fields but do not force free
 * if Apple entitlement is still active.
 */
export async function clearProEntitlement(
  customerId: string,
  subscriptionId?: string
): Promise<void> {
  const supabase = await createServiceRoleClient();
  const userId = await resolveClerkUserIdFromStripeCustomer(customerId);

  const { data: existing } = await supabase
    .from("profiles")
    .select("apple_entitlement_active")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  const appleActive = Boolean(existing?.apple_entitlement_active);
  const recomputed = recomputePlanFields({
    stripeStatus: "canceled",
    appleActive,
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      plan_tier: recomputed.plan_tier,
      billing_source: recomputed.billing_source,
      stripe_subscription_status: "canceled",
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("clearProEntitlement:", error.message);
    throw error;
  }

  if (!userId) return;

  if (recomputed.plan_tier === "pro") {
    await clearRecipeExpiry(userId);
  } else {
    await stampFreeRecipeExpiry(userId);
  }
}

/**
 * RevenueCat webhook-safe update by Clerk user id (bypasses RLS).
 * Preserves all Stripe fields; only flips apple_entitlement_active + recomputed plan.
 */
export async function syncProfileFromAppleEntitlement(
  clerkUserId: string,
  active: boolean
): Promise<void> {
  const supabase = await createServiceRoleClient();

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("stripe_subscription_status")
    .eq("id", clerkUserId)
    .maybeSingle();

  if (readError) {
    console.error("syncProfileFromAppleEntitlement (read):", readError.message);
    throw readError;
  }

  if (!existing) {
    console.warn(
      "syncProfileFromAppleEntitlement: no profile for",
      clerkUserId
    );
    return;
  }

  const recomputed = recomputePlanFields({
    stripeStatus: existing.stripe_subscription_status,
    appleActive: active,
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      apple_entitlement_active: active,
      plan_tier: recomputed.plan_tier,
      billing_source: recomputed.billing_source,
    })
    .eq("id", clerkUserId);

  if (error) {
    console.error("syncProfileFromAppleEntitlement (update):", error.message);
    throw error;
  }

  if (recomputed.plan_tier === "pro") {
    await clearRecipeExpiry(clerkUserId);
  } else {
    await stampFreeRecipeExpiry(clerkUserId);
  }
}
