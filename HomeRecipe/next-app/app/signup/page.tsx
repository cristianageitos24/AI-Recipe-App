import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">HomeRecipe</h1>
      <p className="text-sm text-gray-600">Let&apos;s get started!</p>
      <SignUp
        forceRedirectUrl="/dashboard"
        signInUrl="/login"
      />
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
