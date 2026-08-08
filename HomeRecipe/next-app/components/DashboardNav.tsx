"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Playfair_Display } from "next/font/google";
import { useEffect, useId, useRef, useState } from "react";
import { useEntitlements } from "@/components/EntitlementsProvider";
import { ProPill } from "@/components/ProPill";
import { UpgradePrompt } from "@/components/UpgradePrompt";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

const ClerkAccountMenu = dynamic(
  () => import("./ClerkAccountMenu").then((mod) => ({ default: mod.ClerkAccountMenu })),
  { ssr: false },
);

const navItems = [
  {
    href: "/dashboard/home",
    label: "Home",
    icon: "/images/dashboard/homeicon.svg",
  },
  {
    href: "/dashboard/cookbook",
    label: "Cookbooks",
    icon: "/images/dashboard/cookbook-icon.svg",
  },
  {
    href: "/dashboard/calendar",
    label: "Meal Calendar",
    shortLabel: "Calendar",
    icon: "/images/dashboard/calendaricon.svg",
    premium: true,
  },
  {
    href: "/dashboard/grocery",
    label: "Grocery List",
    shortLabel: "Grocery",
    icon: "/images/dashboard/groceryicon.svg",
    premium: true,
  },
  {
    href: "/dashboard/video-upload",
    label: "Video Upload",
    icon: "/images/dashboard/videouploadicon.svg",
  },
  {
    href: "/dashboard/about",
    label: "About",
    icon: "/images/dashboard/icon.svg",
  },
] as const;

const primaryTabHrefs = [
  "/dashboard/home",
  "/dashboard/cookbook",
  "/dashboard/calendar",
  "/dashboard/grocery",
] as const;

const moreRoutePrefixes = [
  "/dashboard/video-upload",
  "/dashboard/about",
  "/dashboard/settings",
  "/dashboard/billing",
] as const;

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function MoreIcon() {
  return (
    <svg
      className="mobile-tab-more-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { entitlements } = useEntitlements();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTitleId = useId();
  const moreCloseRef = useRef<HTMLButtonElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const displayName =
    user?.firstName?.trim() ||
    user?.fullName?.trim() ||
    "Account";

  const moreIsActive = moreRoutePrefixes.some((href) => pathMatches(pathname, href));
  const primaryItems = navItems.filter((item) =>
    (primaryTabHrefs as readonly string[]).includes(item.href),
  );
  const moreNavItems = navItems.filter(
    (item) => !(primaryTabHrefs as readonly string[]).includes(item.href),
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    moreCloseRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      moreTriggerRef.current?.focus();
    };
  }, [moreOpen]);

  function openUpgrade() {
    setMoreOpen(false);
    setUpgradeOpen(true);
  }

  function renderDesktopNavItem(item: (typeof navItems)[number]) {
    const isActive = pathMatches(pathname, item.href);
    const locked = Boolean("premium" in item && item.premium && !entitlements.isPro);

    return (
      <li key={item.href} className={isActive ? "active" : ""}>
        {locked ? (
          <button
            type="button"
            className="tab-square nav-premium-button"
            aria-label={`${item.label} — Pro feature`}
            onClick={() => setUpgradeOpen(true)}
          >
            <Image src={item.icon} alt="" width={15} height={15} />
            <span className="tab-tooltip">
              {item.label}
              <ProPill />
            </span>
          </button>
        ) : (
          <Link href={item.href} className="tab-square">
            <Image src={item.icon} alt={item.label} width={15} height={15} />
            <span className="tab-tooltip">{item.label}</span>
          </Link>
        )}
      </li>
    );
  }

  function renderMobileTab(item: (typeof navItems)[number]) {
    const isActive = pathMatches(pathname, item.href);
    const locked = Boolean("premium" in item && item.premium && !entitlements.isPro);
    const label = "shortLabel" in item && item.shortLabel ? item.shortLabel : item.label;

    if (locked) {
      return (
        <li key={item.href}>
          <button
            type="button"
            className={`mobile-tab-item${isActive ? " is-active" : ""}`}
            aria-label={`${item.label} — Pro feature`}
            onClick={openUpgrade}
          >
            <Image src={item.icon} alt="" width={20} height={20} />
            <span>{label}</span>
          </button>
        </li>
      );
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`mobile-tab-item${isActive ? " is-active" : ""}`}
          aria-current={isActive ? "page" : undefined}
          aria-label={item.label}
        >
          <Image src={item.icon} alt="" width={20} height={20} />
          <span>{label}</span>
        </Link>
      </li>
    );
  }

  return (
    <>
      <header className="dashboard-header">
        <Link href="/dashboard/home" className="dashboard-brand">
          <Image
            src="/images/homerecipelogo1-removebg.png"
            alt=""
            width={38}
            height={38}
            className="dashboard-brand-logo"
            priority
          />
          <span className={playfairDisplay.className}>HomeRecipe</span>
        </Link>
        <nav className="dock-nav" aria-label="Dashboard">
          <ul className="dock-tabs">{navItems.map(renderDesktopNavItem)}</ul>
        </nav>
        <div className="account-nav-slot">
          <ClerkAccountMenu displayName={displayName} />
        </div>
      </header>

      <Link href="/dashboard/home" className="mobile-top-brand" aria-label="HomeRecipe home">
        <Image
          src="/images/homerecipelogo1-removebg.png"
          alt=""
          width={28}
          height={28}
          className="mobile-top-brand-logo"
        />
        <span className={`mobile-top-brand-label ${playfairDisplay.className}`}>
          HomeRecipe
        </span>
      </Link>

      <nav className="mobile-tab-bar" aria-label="Primary">
        <ul className="mobile-tab-bar-list">
          {primaryItems.map(renderMobileTab)}
          <li>
            <button
              ref={moreTriggerRef}
              type="button"
              className={`mobile-tab-item${moreIsActive || moreOpen ? " is-active" : ""}`}
              aria-label="More"
              aria-expanded={moreOpen}
              aria-controls="mobile-more-sheet"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreIcon />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <>
          <button
            type="button"
            className="mobile-more-scrim"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="mobile-more-sheet"
            className="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={moreTitleId}
          >
            <div className="mobile-more-handle" aria-hidden />
            <h2 id={moreTitleId} className="mobile-more-title">
              More
            </h2>
            <ul className="mobile-more-list">
              {moreNavItems.map((item) => {
                const isActive = pathMatches(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`mobile-more-link${isActive ? " is-active" : ""}`}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Image src={item.icon} alt="" width={18} height={18} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/dashboard/settings"
                  className={`mobile-more-link${pathMatches(pathname, "/dashboard/settings") ? " is-active" : ""}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span>Settings</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/billing"
                  className={`mobile-more-link${pathMatches(pathname, "/dashboard/billing") ? " is-active" : ""}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span>{entitlements.isPro ? "Billing" : "Upgrade / Billing"}</span>
                </Link>
              </li>
            </ul>
            <div className="mobile-more-account">
              <div className="mobile-more-account-meta">
                <span className="mobile-more-account-label">Account</span>
                <span className="mobile-more-account-name">{displayName}</span>
              </div>
              <ClerkAccountMenu displayName={displayName} />
            </div>
            <button
              ref={moreCloseRef}
              type="button"
              className="mobile-more-link mobile-more-close"
              onClick={() => setMoreOpen(false)}
            >
              Close
            </button>
          </div>
        </>
      ) : null}

      <UpgradePrompt
        open={upgradeOpen}
        reason="planning"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
