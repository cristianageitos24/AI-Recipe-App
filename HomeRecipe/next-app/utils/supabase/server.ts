import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * One Supabase client per React request (Server Components / Actions).
 * Speaks PostgREST over HTTP — not a direct Postgres pool — but avoids
 * re-allocating clients and re-fetching Clerk JWTs within the same request.
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

        // RLS policies use auth.jwt()->>'sub', which must match recipes.user_id (Clerk user id).
        // That requires Clerk's Supabase JWT template so PostgREST gets a compatible token.
        // Clerk Dashboard → JWT Templates → "supabase" (see Supabase integration setup).
        const template =
          process.env.CLERK_SUPABASE_JWT_TEMPLATE?.trim() || "supabase";
        try {
          const supabaseJwt = await getToken({ template });
          if (supabaseJwt) return supabaseJwt;
        } catch {
          /* template name missing or not deployed */
        }

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
