import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import AuthCarousel from "@/components/AuthCarousel";
import "@/app/styling/LoginSignForm.css";

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
    socialButtonsBlockButton:
      "rounded-[50px] border border-black",
    dividerLine: "bg-[rgba(171,171,171,0.3)]",
    dividerText: "text-[#4a4a4a]",
    footer: "hidden",
    footerActionLink: "text-[#dc2100] underline",
  },
};

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-card">
          <Image
            src="/images/homerecipelogo1.png"
            alt="HomeRecipe"
            width={40}
            height={50}
            className="auth-logo"
          />
          <h1 className="auth-title">HomeRecipe</h1>
          <p className="auth-subtitle">Let&apos;s get started!</p>
          <SignUp
            forceRedirectUrl="/dashboard"
            signInUrl="/login"
            appearance={clerkAppearance}
          />
          <p className="auth-link-wrap">
            Already have an account?{" "}
            <Link href="/login">Log In</Link>
          </p>
        </div>
      </div>
      <div className="auth-right">
        <AuthCarousel />
      </div>
    </div>
  );
}
