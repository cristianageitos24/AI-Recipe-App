import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * One Supabase client per React request (Server Components / Actions).
 * Speaks PostgREST over HTTP — not a direct Postgres pool — but avoids
 * re-allocating clients and re-fetching Clerk tokens within the same request.
 *
 * Auth model (Clerk Third-Party Auth):
 * - Clerk owns the browser session cookies.
 * - This client does NOT use Supabase Auth cookies or @supabase/ssr session refresh.
 * - It forwards the Clerk **session token** via `accessToken` so RLS can authorize
 *   with `auth.jwt()->>'sub'` (Clerk user id). Requires Clerk’s Supabase integration
 *   (adds `role: "authenticated"`) and Clerk as a Third-Party Auth provider in Supabase.
 * - Do not use Clerk JWT templates for Supabase (deprecated).
 * See AUTHENTICATION.md.
 */
export const createClient = cache(async () => {
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
        // Default session token (Third-Party Auth) — not a JWT template.
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    },
  });
});

/**
 * Service-role Supabase client for backend-only tasks that need to bypass RLS.
 * Uses SUPABASE_SECRET_KEY and should only be used in trusted server actions / scripts.
 * Memoized per request like `createClient`.
 */
export const createServiceRoleClient = cache(async () => {
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
});
