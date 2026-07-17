"use client";

import { UserButton } from "@clerk/nextjs";
import { useEntitlements } from "@/components/EntitlementsProvider";
import "@/app/styling/UpgradePrompt.css";

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 2v1.5M12 20.5V22M4.93 4.93l1.06 1.06M17.01 17.01l1.06 1.06M2 12h1.5M20.5 12H22M4.93 19.07l1.06-1.06M17.01 6.99l1.06-1.06" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export function ClerkAccountMenu() {
  const { entitlements } = useEntitlements();

  return (
    <span className="clerk-account-menu-wrap">
      <span
        className={`plan-badge-pill${entitlements.isPro ? " plan-badge-pill--pro" : ""}`}
        title={entitlements.isPro ? "Pro plan" : "Free plan"}
      >
        {entitlements.isPro ? "Pro" : "Free"}
      </span>
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Link label="Settings" labelIcon={<GearIcon />} href="/dashboard/settings" />
          <UserButton.Link
            label={entitlements.isPro ? "Billing" : "Upgrade / Billing"}
            labelIcon={<BillingIcon />}
            href="/dashboard/billing"
          />
          <UserButton.Link label="Trash" labelIcon={<TrashIcon />} href="/dashboard/settings#trash" />
        </UserButton.MenuItems>
      </UserButton>
    </span>
  );
}
