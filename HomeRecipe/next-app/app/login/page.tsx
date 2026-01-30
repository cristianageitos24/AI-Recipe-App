import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">HomeRecipe</h1>
      <p className="text-sm text-gray-600">Sign in and let&apos;s start cooking!</p>
      <SignIn
        forceRedirectUrl="/dashboard"
        signUpUrl="/signup"
      />
      <p className="text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
