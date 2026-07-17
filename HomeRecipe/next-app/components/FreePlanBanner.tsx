"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEntitlements } from "@/components/EntitlementsProvider";
import "@/app/styling/UpgradePrompt.css";

const STORAGE_KEY = "homerecipe_free_welcome_dismissed_v1";

export function FreePlanBanner() {
  const { entitlements, loading } = useEntitlements();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || entitlements.isPro) {
      setVisible(false);
      return;
    }
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, [entitlements.isPro, loading]);

  if (!visible || entitlements.isPro) return null;

  return (
    <div className="free-plan-banner" role="status">
      <p>
        You’re on Free — {entitlements.extractionsLimit} recipe extractions per
        month. Your recipes expire after {entitlements.recipeTtlDays} days.{" "}
        <Link href="/dashboard/billing">Upgrade</Link> for the full library and
        macros.
      </p>
      <button
        type="button"
        aria-label="Dismiss free plan notice"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setVisible(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
