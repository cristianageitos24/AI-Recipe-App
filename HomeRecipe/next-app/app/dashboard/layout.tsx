import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardNav } from "@/components/DashboardNav";
import { EnsureProfileOnMount } from "@/components/EnsureProfileOnMount";
import { RouteTransition } from "@/components/RouteTransition";
import "@/app/styling/Nav.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/signin");
  }

  return (
    <div className="dashboard-page">
      <EnsureProfileOnMount />
      <DashboardNav />
      <main className="dashboard-main overflow-auto">
        <DashboardShell>
          <RouteTransition>{children}</RouteTransition>
        </DashboardShell>
      </main>
    </div>
  );
}
