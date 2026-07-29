import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client authenticated with a Clerk **session token**.
 *
 * Clerk owns auth cookies — this is not a Supabase Auth session client.
 * Pass a token getter from `useSession()`, e.g. `() => session.getToken()`.
 *
 * Prefer server actions / `utils/supabase/server.ts` for mutations so identity
 * stays on the server. Only use this helper when a Client Component must talk
 * to Supabase directly (e.g. realtime).
 *
 * Requires Clerk Supabase integration + Third-Party Auth in the Supabase project.
 * See AUTHENTICATION.md.
 */
export function createClient(
  getToken: () => Promise<string | null | undefined>
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createSupabaseClient(url, key, {
    accessToken: async () => (await getToken()) ?? null,
  });
}
