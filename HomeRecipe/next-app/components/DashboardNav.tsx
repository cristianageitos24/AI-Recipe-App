"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => ({ default: mod.UserButton })),
  { ssr: false }
);

const navItems = [
  { href: "/dashboard/home", label: "Home", icon: "/images/dashboard/homeicon.svg" },
  { href: "/dashboard/cookbook", label: "Cookbooks", icon: "/images/dashboard/cookbook-icon.svg" },
  { href: "/dashboard/calendar", label: "Meal Calendar", icon: "/images/dashboard/calendaricon.svg" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="left-side-panel">
      <Link href="/dashboard/home" className="top-title">
        <div className="icon-text-main">
          <Image
            src="/images/homerecipelogo1.png"
            alt="HomeRecipe"
            width={32}
            height={40}
            className="web-icon"
          />
          <p>HomeRecipe</p>
        </div>
      </Link>
      <ul className="side-tabs">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className={isActive ? "active" : ""}>
              <Link href={href}>
                <img src={icon} alt="" width={15} height={15} />
                <p>{label}</p>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="bottom-nav-content">
        <div className="loggedin-username-label">
          <UserButton afterSignOutUrl="/" />
          <span className="signedin-label">Account</span>
        </div>
      </div>
    </aside>
  );
}
