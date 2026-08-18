"use client";

import { useState } from "react";
import type { BillingSource } from "@/lib/billing";

type Props = {
  isPro: boolean;
  billingSource?: BillingSource;
};

export function BillingActions({ isPro, billingSource = null }: Props) {
  const [loading, setLoading] = useState<"month" | "year" | "portal" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(interval: "month" | "year") {
    setError(null);
    setLoading(interval);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  }

  async function openPortal() {
    setError(null);
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open billing portal");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
      setLoading(null);
    }
  }

  const isApplePro = isPro && billingSource === "apple";

  return (
    <div className="billing-actions">
      {error ? (
        <p className="billing-error" role="alert">
          {error}
        </p>
      ) : null}

      {isApplePro ? (
        <p className="billing-muted">
          Managed via the App Store / iOS HomeRecipe app. Cancel or change your
          plan in Settings → Apple ID → Subscriptions on your device.
        </p>
      ) : isPro ? (
        <button
          type="button"
          className="billing-btn billing-btn-secondary"
          disabled={loading !== null}
          onClick={() => void openPortal()}
        >
          {loading === "portal" ? "Opening…" : "Manage subscription"}
        </button>
      ) : (
        <div className="billing-upgrade-row">
          <button
            type="button"
            className="billing-btn billing-btn-primary"
            disabled={loading !== null}
            onClick={() => void startCheckout("month")}
          >
            {loading === "month" ? "Redirecting…" : "Upgrade — $1.99/mo"}
          </button>
          <button
            type="button"
            className="billing-btn billing-btn-secondary"
            disabled={loading !== null}
            onClick={() => void startCheckout("year")}
          >
            {loading === "year" ? "Redirecting…" : "Upgrade — $20/yr"}
          </button>
        </div>
      )}
    </div>
  );
}
