import { NextResponse } from "next/server";
import { requireAuthUserIdForApi } from "@/lib/auth";
import {
  getAppBaseUrl,
  getSubscriptionPriceId,
  getStripe,
  STRIPE_MANAGED_PAYMENTS_API_VERSION,
} from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/billing";

/**
 * Create a Managed Payments Checkout Session for HomeRecipe Pro.
 *
 * Tax: Managed Payments calculates/withholds tax — do NOT pass automatic_tax
 * (Stripe docs: remove automatic_tax for Managed Payments Checkout).
 * Product tax_code is SaaS personal use (txcd_10103000).
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthUserIdForApi();
    if (authResult.response) return authResult.response;
    const { userId } = authResult;

    const body = (await request.json().catch(() => ({}))) as {
      interval?: "month" | "year";
    };
    const interval = body.interval === "year" ? "year" : "month";
    const priceId = getSubscriptionPriceId(interval);

    const { customerId } = await ensureStripeCustomer();
    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    // Managed Payments preview API — required by Stripe blueprint
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/dashboard/billing?checkout=canceled`,
        // Tax + MoR: Stripe Managed Payments (do not set automatic_tax)
        managed_payments: { enabled: true },
        client_reference_id: userId,
        metadata: {
          clerk_user_id: userId,
        },
        subscription_data: {
          metadata: {
            clerk_user_id: userId,
          },
        },
      },
      {
        apiVersion: STRIPE_MANAGED_PAYMENTS_API_VERSION,
      }
    );

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout Session missing redirect URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("create-checkout-session:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
