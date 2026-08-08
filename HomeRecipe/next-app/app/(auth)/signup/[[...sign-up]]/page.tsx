import Image from "next/image";
import Link from "next/link";
import { ClientSignUp } from "@/components/ClientSignUp";

export default function SignUpPage() {
  return (
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

      <ClientSignUp />

      <p className="auth-legal">
        By continuing, you agree we may process your data as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
