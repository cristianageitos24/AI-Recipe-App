import Link from "next/link";
import Image from "next/image";
import AuthCarousel from "@/components/AuthCarousel";
import { ClientSignUp } from "@/components/ClientSignUp";
import "@/app/styling/LoginSignForm.css";

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

          {/* This holds the Sign Up form with Sign In button option */}
          <ClientSignUp />
        </div>
      </div>
      <div className="auth-right">
        <AuthCarousel />
      </div>
    </div>
  );
}
