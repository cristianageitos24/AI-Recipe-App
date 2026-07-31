"use client";

import { useRef } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEntitlements } from "@/components/EntitlementsProvider";
import { ProPill } from "@/components/ProPill";
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

type Props = {
  displayName: string;
};

function findUserButtonTrigger(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return (
    root.querySelector<HTMLElement>(".cl-userButtonTrigger") ??
    Array.from(root.querySelectorAll<HTMLElement>("button")).find(
      (btn) => !btn.classList.contains("account-menu-hitarea")
    ) ??
    null
  );
}

export function ClerkAccountMenu({ displayName }: Props) {
  const { entitlements } = useEntitlements();
  const rootRef = useRef<HTMLDivElement>(null);

  function openAccountMenu() {
    findUserButtonTrigger(rootRef.current)?.click();
  }

  return (
    <div className="account-nav account-nav--menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-hitarea"
        aria-label="Open account menu"
        onClick={openAccountMenu}
      />
      <div className="loggedin-username-label">
        <span className="clerk-account-menu-wrap">
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: "2.5rem",
                  height: "2.5rem",
                },
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link
                label="Settings"
                labelIcon={<GearIcon />}
                href="/dashboard/settings"
              />
              <UserButton.Link
                label={entitlements.isPro ? "Billing" : "Upgrade / Billing"}
                labelIcon={<BillingIcon />}
                href="/dashboard/billing"
              />
              <UserButton.Link
                label="Trash"
                labelIcon={<TrashIcon />}
                href="/dashboard/settings#trash"
              />
            </UserButton.MenuItems>
          </UserButton>
          <span className="clerk-account-menu-meta">
            <span className="signedin-label">{displayName}</span>
            {entitlements.isPro ? (
              <span className="plan-badge-slot" title="Pro plan">
                <ProPill />
              </span>
            ) : (
              <Link
                href="/dashboard/billing"
                className="plan-upgrade-chip"
                aria-label="Upgrade to Pro"
              >
                Upgrade to Pro
              </Link>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
