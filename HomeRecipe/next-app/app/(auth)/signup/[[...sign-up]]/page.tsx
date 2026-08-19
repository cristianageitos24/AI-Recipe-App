import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClientSignUp } from "@/components/ClientSignUp";
import { noIndexRobots, SITE_LOGO_PATH } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a HomeRecipe account to save recipes and plan meals.",
  robots: noIndexRobots(),
};

export default function SignUpPage() {
  return (
    <div className="auth-card">
      <Link href="/" aria-label="HomeRecipe home">
        <Image
          src={SITE_LOGO_PATH}
          alt="HomeRecipe"
          width={40}
          height={50}
          className="auth-logo"
        />
      </Link>
      <h1 className="auth-title">HomeRecipe</h1>
      <p className="auth-subtitle">Let&apos;s get started!</p>

      <ClientSignUp />

      <p className="auth-legal">
        By continuing, you agree we may process your data as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
