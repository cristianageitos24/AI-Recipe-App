"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { signIn, type AuthState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(signIn, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">HomeRecipe</h1>
      <h2 className="text-xl">Log In</h2>
      <p className="text-sm text-gray-600">Sign in and let&apos;s start cooking!</p>
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="Enter your email"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            placeholder="Enter your password"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Login
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
