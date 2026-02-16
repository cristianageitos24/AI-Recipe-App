"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => ({ default: mod.UserButton })),
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
  },
  {
    href: "/dashboard/grocery",
    label: "Grocery List",
    icon: "/images/dashboard/groceryicon.svg",
  },
  {
    href: "/dashboard/video-upload",
    label: "Video Upload",
    icon: "/images/dashboard/videouploadicon.svg",
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="dock-nav">
        <ul className="dock-tabs">
          {navItems.map(({ href, label, icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className={isActive ? "active" : ""}>
                <Link href={href} className="tab-square">
                  <Image src={icon} alt={label} width={15} height={15} />
                  <span className="tab-tooltip">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="account-nav">
        <div className="loggedin-username-label">
          <UserButton />
          <span className="signedin-label">Account</span>
        </div>
      </div>
    </>
  );
}
