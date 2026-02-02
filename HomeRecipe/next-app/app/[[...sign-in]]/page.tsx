import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
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

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

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
          <p className="auth-subtitle">Sign in and let&apos;s start cooking!</p>
          <SignIn
            forceRedirectUrl="/dashboard"
            signUpUrl="/signup"
            appearance={clerkAppearance}
          />
          <p className="auth-link-wrap">
            Don&apos;t have an account?{" "}
            <Link href="/signup">Sign up</Link>
          </p>
        </div>
      </div>
      <div className="auth-right">
        <AuthCarousel />
      </div>
    </div>
  );
}
