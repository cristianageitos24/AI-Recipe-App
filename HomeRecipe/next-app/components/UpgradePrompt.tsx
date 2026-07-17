"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { PlanLimitReason } from "@/lib/entitlements-constants";
import "@/app/styling/UpgradePrompt.css";

const COPY: Record<
  PlanLimitReason,
  { title: string; body: string }
> = {
  catalog: {
    title: "Unlock the full recipe library",
    body: "Pro members get every recipe, collections, and web search — not just your own extracts.",
  },
  nutrition: {
    title: "Unlock full nutrients & macros",
    body: "See protein, carbs, fat, and ingredient confidence on every recipe with Pro.",
  },
  extractions: {
    title: "You've used your free extractions",
    body: "Free includes 3 recipe extractions per month. Upgrade for unlimited URL and video imports.",
  },
  expiry: {
    title: "This recipe expired",
    body: "Free recipes last 30 days. Upgrade to Pro to keep your recipes forever.",
  },
};

type Props = {
  open: boolean;
  reason: PlanLimitReason;
  onClose: () => void;
};

export function UpgradePrompt({ open, reason, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState<"month" | "year" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const copy = COPY[reason];

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

  return (
    <div
      className="upgrade-prompt-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="upgrade-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="upgrade-prompt-title">
          {copy.title}
        </h2>
        <p className="upgrade-prompt-body">{copy.body}</p>
        {error ? (
          <p className="upgrade-prompt-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="upgrade-prompt-actions">
          <button
            type="button"
            className="upgrade-prompt-btn upgrade-prompt-btn-primary"
            disabled={loading !== null}
            onClick={() => void startCheckout("month")}
          >
            {loading === "month" ? "Redirecting…" : "Upgrade — $1.99/mo"}
          </button>
          <button
            type="button"
            className="upgrade-prompt-btn upgrade-prompt-btn-secondary"
            disabled={loading !== null}
            onClick={() => void startCheckout("year")}
          >
            {loading === "year" ? "Redirecting…" : "Upgrade — $20/yr"}
          </button>
          <button
            ref={closeRef}
            type="button"
            className="upgrade-prompt-btn upgrade-prompt-btn-ghost"
            disabled={loading !== null}
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
        <p className="upgrade-prompt-footer">
          <Link href="/dashboard/billing" onClick={onClose}>
            Compare plans on Billing
          </Link>
        </p>
      </div>
    </div>
  );
}
