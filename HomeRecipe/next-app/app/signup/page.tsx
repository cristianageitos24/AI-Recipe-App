"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { signUp, type AuthState } from "@/app/actions/auth";

export default function SignUpPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(signUp, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">HomeRecipe</h1>
      <h2 className="text-xl">Create Your Account</h2>
      <p className="text-sm text-gray-600">Let&apos;s get started!</p>
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
          <span className="text-sm font-medium">Username</span>
          <input
            name="username"
            type="text"
            placeholder="Enter your username"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            placeholder="Enter your password (min 6 characters)"
            minLength={6}
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
          Sign Up
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
