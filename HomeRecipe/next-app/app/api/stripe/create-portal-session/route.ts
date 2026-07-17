import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAppBaseUrl, getStripe } from "@/lib/stripe";
import { ensureStripeCustomer, getProfileBilling } from "@/lib/billing";

/** Stripe Customer Portal — manage subscription, payment method, invoices. */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureStripeCustomer();
    const profile = await getProfileBilling(userId);
    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer on file" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppBaseUrl()}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed";
    console.error("create-portal-session:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
