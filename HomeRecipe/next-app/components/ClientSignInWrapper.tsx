"use client";

import dynamic from "next/dynamic";

// Dynamically import ClientSignIn with SSR disabled to prevent hydration errors
const ClientSignIn = dynamic(() => import("@/components/ClientSignIn").then((mod) => ({ default: mod.ClientSignIn })), {
  ssr: false,
});

export function ClientSignInWrapper() {
  return <ClientSignIn />;
}
