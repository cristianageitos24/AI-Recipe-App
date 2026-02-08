"use client";

import { SignUp } from "@clerk/nextjs";

const clerkAppearance = {
  variables: {
    colorPrimary: "#000",
    colorDanger: "#dc2100",
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
    dividerText: "text-[#4a4a4a]",
    footer: "hidden",
    footerActionLink: "text-[#dc2100] underline",
  },
};

export function ClientSignUp() {
  return (
    <SignUp
      forceRedirectUrl="/dashboard"
      signInUrl="/signin"
      appearance={clerkAppearance}
    />
  );
}
