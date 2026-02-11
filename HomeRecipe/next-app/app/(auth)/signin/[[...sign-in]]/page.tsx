import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ClientSignIn } from "@/components/ClientSignIn";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

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
    </div>
  );
}
