"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

export function DashboardNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard/home", label: "Home" },
    { href: "/dashboard/cookbook", label: "Cookbooks" },
    { href: "/dashboard/calendar", label: "Meal Calendar" },
  ];

  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-gray-50 p-4">
      <Link href="/dashboard/home" className="mb-6 flex items-center gap-2 font-semibold">
        HomeRecipe
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded px-3 py-2 text-sm ${
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-gray-200 font-medium"
                : "hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-gray-600">Account</span>
        </div>
      </div>
    </aside>
  );
}
