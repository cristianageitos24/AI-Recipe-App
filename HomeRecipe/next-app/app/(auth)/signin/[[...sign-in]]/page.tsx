import Image from "next/image";
import Link from "next/link";
import { ClientSignIn } from "@/components/ClientSignIn";

export default function SignInPage() {
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
      <p className="auth-subtitle">Sign in and let&apos;s start cooking!</p>

      <ClientSignIn />

      <p className="auth-legal">
        <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}
