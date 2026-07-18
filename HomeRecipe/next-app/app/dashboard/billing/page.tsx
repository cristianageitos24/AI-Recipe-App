import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/app/actions/profiles";
import { getProfileBilling } from "@/lib/billing";
import { isProSubscriptionStatus } from "@/lib/stripe";
import { BillingActions } from "@/components/BillingActions";
import "@/app/styling/BillingPage.css";

type SearchParams = Promise<{ checkout?: string }>;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  await ensureProfile();
  const profile = await getProfileBilling(userId);
  const params = await searchParams;

  const isPro =
    profile?.plan_tier === "pro" ||
    isProSubscriptionStatus(profile?.stripe_subscription_status);

  return (
    <div className="billing-page">
      <h1 className="billing-title">Billing</h1>

      {params.checkout === "success" ? (
        <p className="billing-banner billing-banner-success" role="status">
          Payment received. Pro access updates when Stripe confirms the
          subscription (usually a few seconds). Refresh if status is still Free.
        </p>
      ) : null}
      {params.checkout === "canceled" ? (
        <p className="billing-banner" role="status">
          Checkout canceled — no charge was made.
        </p>
      ) : null}

      <section className="billing-plan" aria-labelledby="billing-plan-heading">
        <h2 id="billing-plan-heading" className="billing-h2">
          Your plan
        </h2>
        <p className="billing-plan-badge">{isPro ? "Pro" : "Free"}</p>
        {profile?.stripe_subscription_status ? (
          <p className="billing-muted">
            Stripe status: {profile.stripe_subscription_status}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="billing-compare-heading">
        <h2 id="billing-compare-heading" className="billing-h2">
          What you get
        </h2>
        <ul className="billing-list">
          <li>
            <strong>Free:</strong> a small recipe set and a few recipe
            extractions per month
          </li>
          <li>
            <strong>Pro:</strong> all recipes, full nutrients &amp; macros, and
            unlimited extractions
          </li>
        </ul>
        <p className="billing-muted">
          Tax is calculated at Checkout by Stripe Managed Payments based on your
          billing address — we never invent tax rates in the app.
        </p>
      </section>

      <BillingActions isPro={isPro} />
    </div>
  );
}
