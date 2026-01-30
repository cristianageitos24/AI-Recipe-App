import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">HomeRecipe</h1>
      <p className="text-gray-600">Simple and tasty recipes.</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Log In
        </Link>
        <Link
          href="/signup"
          className="rounded border border-black px-4 py-2 hover:bg-gray-100"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
