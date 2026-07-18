"use client";

import { useState, type ReactNode } from "react";
import { useEntitlements } from "@/components/EntitlementsProvider";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import "@/app/styling/UpgradePrompt.css";

type Props = {
  children: ReactNode;
  featureName: string;
  description: string;
};

export function PremiumFeatureGate({
  children,
  featureName,
  description,
}: Props) {
  const { entitlements, loading } = useEntitlements();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (loading) {
    return (
      <div className="main-panel premium-feature-loading" role="status">
        Loading…
      </div>
    );
  }

  if (entitlements.isPro) return children;

  return (
    <div className="main-panel premium-feature-page">
      <section className="premium-feature-card" aria-labelledby="premium-feature-title">
        <span className="premium-feature-lock" aria-hidden>
          🔒
        </span>
        <p className="premium-feature-eyebrow">Pro feature</p>
        <h1 id="premium-feature-title">{featureName}</h1>
        <p>{description}</p>
        <button type="button" onClick={() => setUpgradeOpen(true)}>
          Upgrade to Pro
        </button>
      </section>
      <UpgradePrompt
        open={upgradeOpen}
        reason="planning"
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}
