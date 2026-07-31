import { requireAuthUserIdOrRedirect } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardNav } from "@/components/DashboardNav";
import { EnsureProfileOnMount } from "@/components/EnsureProfileOnMount";
import { RouteTransition } from "@/components/RouteTransition";
import { EntitlementsProvider } from "@/components/EntitlementsProvider";
import { getMyEntitlements } from "@/app/actions/entitlements";
import "@/app/styling/Nav.css";
import "@/app/styling/UpgradePrompt.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthUserIdOrRedirect();

  const entitlementsRes = await getMyEntitlements();

  return (
    <div className="dashboard-page">
      <EnsureProfileOnMount />
      <EntitlementsProvider initial={entitlementsRes.data}>
        <DashboardNav />
        <main className="dashboard-main overflow-auto">
          <DashboardShell>
            <RouteTransition>{children}</RouteTransition>
          </DashboardShell>
        </main>
      </EntitlementsProvider>
    </div>
  );
}
