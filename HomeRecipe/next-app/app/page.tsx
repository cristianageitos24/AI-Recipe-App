import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import "@/app/styling/LoginSignForm.css";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Image
          src="/images/homerecipelogo1.png"
          alt="HomeRecipe"
          width={40}
          height={50}
          className="auth-logo"
        />
        <h1 className="auth-title">HomeRecipe</h1>
        <p className="auth-subtitle">Simple and tasty recipes.</p>
        <div className="landing-ctas">
          <Link
            href="/login"
            className="landing-btn-primary"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="landing-btn-secondary"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
