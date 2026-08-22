import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClientSignIn } from "@/components/ClientSignIn";
import { noIndexRobots, SITE_LOGO_PATH } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your HomeRecipe account.",
  robots: noIndexRobots(),
};

export default function SignInPage() {
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
      <p className="auth-subtitle">Sign in and let&apos;s start cooking!</p>

      <ClientSignIn />

      <p className="auth-legal">
        <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}
