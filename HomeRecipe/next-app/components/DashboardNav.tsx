"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Playfair_Display } from "next/font/google";
import { useState } from "react";
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
    icon: "/images/dashboard/calendaricon.svg",
    premium: true,
  },
  {
    href: "/dashboard/grocery",
    label: "Grocery List",
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
];

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { entitlements } = useEntitlements();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const displayName =
    user?.firstName?.trim() ||
    user?.fullName?.trim() ||
    "Account";

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
        <nav className="dock-nav">
          <ul className="dock-tabs">
            {navItems.map(({ href, label, icon, premium }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + "/");
              const locked = Boolean(premium && !entitlements.isPro);
              return (
                <li key={href} className={isActive ? "active" : ""}>
                  {locked ? (
                    <button
                      type="button"
                      className="tab-square nav-premium-button"
                      aria-label={`${label} — Pro feature`}
                      onClick={() => setUpgradeOpen(true)}
                    >
                      <Image src={icon} alt="" width={15} height={15} />
                      <span className="tab-tooltip">
                        {label}
                        <ProPill />
                      </span>
                    </button>
                  ) : (
                    <Link href={href} className="tab-square">
                      <Image src={icon} alt={label} width={15} height={15} />
                      <span className="tab-tooltip">{label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="account-nav">
          <div className="loggedin-username-label">
            <ClerkAccountMenu displayName={displayName} />
          </div>
        </div>
      </header>
      <UpgradePrompt
        open={upgradeOpen}
        reason="planning"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
