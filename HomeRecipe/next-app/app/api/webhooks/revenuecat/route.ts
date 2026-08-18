import { NextResponse } from "next/server";
import { syncProfileFromAppleEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

/** Must match RevenueCat entitlement identifier exactly. */
const PRO_ENTITLEMENT_ID = "HomeRecipe Pro";

/** Known HomeRecipe IAP product ids (defensive fallback if entitlement_ids absent). */
const PRO_PRODUCT_IDS = new Set(["Monthly", "Yearly"]);

const GRANT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);

const REVOKE_TYPES = new Set(["EXPIRATION"]);

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string | null;
  new_product_id?: string | null;
};

function isAnonymousAppUserId(appUserId: string): boolean {
  const id = appUserId.trim();
  if (!id) return true;
  // RevenueCat anonymous ids + common prefixes
  if (id.startsWith("$RCAnonymousID:")) return true;
  if (id.toLowerCase().startsWith("anonymous")) return true;
  return false;
}

function eventTouchesPro(event: RevenueCatEvent): boolean {
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [];
  if (entitlementIds.includes(PRO_ENTITLEMENT_ID)) return true;
  if (event.entitlement_id === PRO_ENTITLEMENT_ID) return true;

  const productId = event.product_id ?? event.new_product_id ?? null;
  if (productId && PRO_PRODUCT_IDS.has(productId)) return true;

  return false;
}

/**
 * RevenueCat webhooks — sync Apple IAP Pro onto profiles (same plan_tier as Stripe).
 * Auth: Authorization header must exactly equal REVENUECAT_WEBHOOK_SECRET (no HMAC).
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const root = body as { event?: RevenueCatEvent } & RevenueCatEvent;
  const event: RevenueCatEvent = root.event ?? root;
  const type = typeof event.type === "string" ? event.type : "";
  const appUserId =
    (typeof event.app_user_id === "string" && event.app_user_id) ||
    (typeof event.original_app_user_id === "string" &&
      event.original_app_user_id) ||
    "";

  if (!type) {
    return NextResponse.json({ received: true });
  }

  // Ignore anonymous RC ids so RC does not retry forever
  if (!appUserId || isAnonymousAppUserId(appUserId)) {
    console.info(
      "RevenueCat webhook: ignoring anonymous/missing app_user_id",
      { type, appUserId: appUserId || null }
    );
    return NextResponse.json({ received: true });
  }

  // CANCELLATION and other non-grant/revoke types: access continues until EXPIRATION
  if (!GRANT_TYPES.has(type) && !REVOKE_TYPES.has(type)) {
    return NextResponse.json({ received: true });
  }

  if (!eventTouchesPro(event)) {
    console.info("RevenueCat webhook: event does not touch Pro entitlement", {
      type,
      appUserId,
    });
    return NextResponse.json({ received: true });
  }

  try {
    if (GRANT_TYPES.has(type)) {
      await syncProfileFromAppleEntitlement(appUserId, true);
    } else if (REVOKE_TYPES.has(type)) {
      await syncProfileFromAppleEntitlement(appUserId, false);
    }
  } catch (err) {
    console.error(`RevenueCat webhook handler error (${type}):`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
