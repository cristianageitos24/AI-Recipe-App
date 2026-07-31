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

export type ProfileBilling = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_price_id: string | null;
  plan_tier: "free" | "pro";
};

export async function getProfileBilling(
  userId: string
): Promise<ProfileBilling | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, plan_tier"
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
  const fields = planTierFromSubscription(subscription);
  const patch = {
    stripe_customer_id: customerId,
    ...fields,
  };

  const resolvedUserId =
    clerkUserId ||
    (await resolveClerkUserIdFromStripeCustomer(customerId));

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

  if (fields.plan_tier === "pro") {
    await clearRecipeExpiry(resolvedUserId);
  } else {
    await stampFreeRecipeExpiry(resolvedUserId);
  }
}

export async function clearProEntitlement(
  customerId: string,
  subscriptionId?: string
): Promise<void> {
  const supabase = await createServiceRoleClient();
  const userId = await resolveClerkUserIdFromStripeCustomer(customerId);

  const { error } = await supabase
    .from("profiles")
    .update({
      plan_tier: "free",
      stripe_subscription_status: "canceled",
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("clearProEntitlement:", error.message);
    throw error;
  }

  if (userId) {
    await stampFreeRecipeExpiry(userId);
  }
}
