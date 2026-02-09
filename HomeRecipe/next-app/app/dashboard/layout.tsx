import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { ensureProfile } from "@/app/actions/profiles";
import "@/app/styling/Nav.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  await ensureProfile();

  return (
    <div className="dashboard-page">
      <DashboardNav />
      <main className="dashboard-main overflow-auto">{children}</main>
    </div>
  );
}
