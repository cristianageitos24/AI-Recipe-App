import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * One Supabase client per React request (Server Components / Actions).
 * Speaks PostgREST over HTTP — not a direct Postgres pool — but avoids
 * re-allocating clients and re-fetching Clerk JWTs within the same request.
 *
 * Auth model: Clerk owns the browser session. This client does NOT use
 * Supabase Auth cookies or @supabase/ssr session refresh. It forwards a
 * Clerk-issued JWT via `accessToken` so RLS can authorize as that user.
 *
 * Technical debt: requesting a Clerk JWT *template* named "supabase" (or
 * `CLERK_SUPABASE_JWT_TEMPLATE`) follows the older JWT-template integration.
 * Supabase documents that path as deprecated in favor of Third-Party Auth
 * with Clerk session tokens. Keep this working path for now; do not treat
 * JWT templates as the preferred long-term architecture. See AUTHENTICATION.md.
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

        // Existing (deprecated) JWT-template path: RLS expects a token whose
        // `sub` matches recipes.user_id (Clerk user id). Prefer Third-Party
        // Auth + session tokens when migrating; until then the template named
        // below must exist in the Clerk Dashboard.
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
