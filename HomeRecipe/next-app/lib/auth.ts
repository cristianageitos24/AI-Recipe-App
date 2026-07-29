import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * Central Clerk session helpers for server code.
 *
 * Clerk owns authentication cookies and validates them via `auth()`.
 * This module does not create, modify, or clear cookies — it only reads
 * the validated session and maps missing/expired sessions to app behavior.
 *
 * Callers keep their existing unauthorized shapes:
 * - Server Actions: return `{ error: "Unauthorized", ... }` (or `ok: false`)
 * - Route Handlers: HTTP 401 JSON
 * - Server Components / layouts: redirect to `/signin`
 */

/** Clerk user id for the current request, or null if unsigned / invalid / expired. */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Server Components and layouts: redirect unauthenticated users to sign-in.
 * Returns a guaranteed user id when a valid Clerk session exists.
 */
export async function requireAuthUserIdOrRedirect(
  signInPath = "/signin"
): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) {
    redirect(signInPath);
  }
  return userId;
}

/**
 * Route Handlers: return a 401 JSON response when there is no valid session.
 * On success, returns `{ userId }`. On failure, returns `{ response }` to early-return.
 */
export async function requireAuthUserIdForApi(): Promise<
  | { userId: string; response?: undefined }
  | { userId?: undefined; response: NextResponse }
> {
  const userId = await getAuthUserId();
  if (!userId) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId };
}
