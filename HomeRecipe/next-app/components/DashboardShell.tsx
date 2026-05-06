"use client";

import { TrashUndoProvider } from "@/components/TrashUndoProvider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <TrashUndoProvider>{children}</TrashUndoProvider>;
}
