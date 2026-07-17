import Stripe from "stripe";

/**
 * Managed Payments (tax / MoR) requires the preview API version from Stripe's blueprint.
 * Do not set a guessed apiVersion on the constructor for other calls — pass per-request
 * when creating Managed Payments Checkout Sessions.
 */
export const STRIPE_MANAGED_PAYMENTS_API_VERSION = "2026-02-25.preview" as const;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  // Leave apiVersion unset so the account default is used, except where we
  // explicitly pass Managed Payments preview headers on Checkout Session create.
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  return fromEnv || "http://localhost:3000";
}

export function getProPriceId(interval: "month" | "year" = "month"): string {
  if (interval === "year") {
    const yearly = process.env.STRIPE_PRICE_ID_PRO_YEARLY;
    if (!yearly) {
      throw new Error("STRIPE_PRICE_ID_PRO_YEARLY is not set");
    }
    return yearly;
  }

  const monthly =
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY || process.env.STRIPE_PRICE_ID_PRO;
  if (!monthly) {
    throw new Error("STRIPE_PRICE_ID_PRO_MONTHLY (or STRIPE_PRICE_ID_PRO) is not set");
  }
  return monthly;
}

export function isProSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
