"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard/home"
        signUpForceRedirectUrl="/dashboard/home"
      />
      <p className="text-sm text-[var(--color-fg-muted)]">Completing sign in...</p>
    </div>
  );
}
