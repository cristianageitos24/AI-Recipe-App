"use client";

import { SignUp } from "@clerk/nextjs";

const clerkAppearance = {
  variables: {
    colorPrimary: "#171717",
    colorDanger: "#ba3523",
    borderRadius: "20px",
  },
  elements: {
    formButtonPrimary:
      "bg-black text-white rounded-[50px] border border-black hover:bg-white hover:text-black hover:border-black transition-colors",
    formFieldInput:
      "rounded-[20px] border border-[rgba(171,171,171,0.3)] focus:border-black",
    card: "shadow-none",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton: "rounded-[50px] border border-black",
    dividerLine: "bg-[rgba(171,171,171,0.3)]",
    dividerText: "text-[var(--color-fg-muted)]",
    footer: "hidden",
    footerActionLink: "text-[var(--accent)] underline",
  },
};

export function ClientSignUp() {
  return (
    <SignUp
      routing="hash"
      forceRedirectUrl="/dashboard/home"
      signInUrl="/signin"
      appearance={clerkAppearance}
    />
  );
}
