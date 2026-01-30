"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import type { User } from "@supabase/supabase-js";

export function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname();
  const email = user?.email ?? "";

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
        <p className="truncate text-xs text-gray-500">Signed in as</p>
        <p className="truncate text-sm font-medium">{email}</p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="text-sm text-gray-600 underline hover:text-black"
          >
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
