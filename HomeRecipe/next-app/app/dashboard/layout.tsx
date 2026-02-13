import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { EnsureProfileOnMount } from "@/components/EnsureProfileOnMount";
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
      <main className="dashboard-main overflow-auto">{children}</main>
    </div>
  );
}
