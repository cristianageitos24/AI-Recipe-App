import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error(
      "Supabase env missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
    throw new Error("Server misconfiguration");
  }

  return createSupabaseClient(url, key, {
    accessToken: async () => {
      try {
        const authObj = await auth();
        const getToken = authObj?.getToken;
        if (typeof getToken !== "function") return null;
        const token = await getToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
  });
}
