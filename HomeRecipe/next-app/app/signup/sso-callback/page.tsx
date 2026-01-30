"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <AuthenticateWithRedirectCallback
        signUpForceRedirectUrl="/dashboard"
        signInForceRedirectUrl="/dashboard"
      />
      <p className="text-sm text-gray-500">Completing sign in...</p>
    </div>
  );
}
