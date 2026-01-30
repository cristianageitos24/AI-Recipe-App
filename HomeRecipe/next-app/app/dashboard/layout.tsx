import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <div className="flex min-h-screen">
      <DashboardNav user={user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
