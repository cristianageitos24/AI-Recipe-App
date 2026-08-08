import { requireAuthUserIdOrRedirect } from "@/lib/auth";
import { ensureProfile } from "@/app/actions/profiles";
import { getProfileBilling } from "@/lib/billing";
import { isProSubscriptionStatus } from "@/lib/stripe";
import { BillingActions } from "@/components/BillingActions";
import { CheckoutSuccessPoller } from "@/components/CheckoutSuccessPoller";
import { PlanCompareCards } from "@/components/PlanCompareCards";
import "@/app/styling/BillingPage.css";
import "@/app/styling/mobile/settings-billing-about.css";

type SearchParams = Promise<{ checkout?: string }>;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userId = await requireAuthUserIdOrRedirect();

  await ensureProfile();
  const profile = await getProfileBilling(userId);
  const params = await searchParams;

  const billingSource = profile?.billing_source ?? null;
  const isPro =
    profile?.plan_tier === "pro" ||
    isProSubscriptionStatus(profile?.stripe_subscription_status) ||
    Boolean(profile?.apple_entitlement_active);
  const isApplePro = isPro && billingSource === "apple";

  return (
    <div className="billing-page">
      <h1 className="billing-title">Billing</h1>

      {params.checkout === "success" ? (
        <>
          <p className="billing-banner billing-banner-success" role="status">
            Payment received. Confirming Pro access…
          </p>
          <CheckoutSuccessPoller />
        </>
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
        {isApplePro ? (
          <p className="billing-muted">
            Managed via the App Store / iOS HomeRecipe app
          </p>
        ) : profile?.stripe_subscription_status ? (
          <p className="billing-muted">
            Stripe status: {profile.stripe_subscription_status}
          </p>
        ) : null}
      </section>

      <section
        className="billing-compare"
        aria-labelledby="billing-compare-heading"
      >
        <h2 id="billing-compare-heading" className="billing-h2">
          What you get
        </h2>
        <PlanCompareCards mode="static" emphasizePro={!isPro} />
        {!isApplePro ? (
          <p className="billing-muted">
            Tax is calculated at Checkout by Stripe Managed Payments based on
            your billing address — we never invent tax rates in the app.
          </p>
        ) : null}
      </section>

      <BillingActions isPro={isPro} billingSource={billingSource} />
    </div>
  );
}
