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

/**
 * Service-role Supabase client for backend-only tasks that need to bypass RLS.
 * Uses SUPABASE_SECRET_KEY and should only be used in trusted server actions / scripts.
 */
export async function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error(
      "Supabase env missing for service role client: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY"
    );
    throw new Error("Server misconfiguration (service role)");
  }

  return createSupabaseClient(url, key);
}

