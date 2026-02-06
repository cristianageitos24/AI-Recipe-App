import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AuthCarousel from "@/components/AuthCarousel";
import { ClientSignInWrapper } from "@/components/ClientSignInWrapper";
import "@/app/styling/LoginSignForm.css";

export default async function RootPage() {
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
          <ClientSignInWrapper />
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
