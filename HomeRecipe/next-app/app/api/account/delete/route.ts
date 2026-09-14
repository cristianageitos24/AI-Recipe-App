import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAuthUserIdForApi } from "@/lib/auth";
import { deleteAccountData } from "@/lib/account-deletion";
import { revokeAppleCredentials } from "@/lib/apple-revoke";

/**
 * Permanent account deletion for the website and the iOS app.
 *
 * App Store Review Guideline 5.1.1(v) requires an app that creates accounts to
 * let users start permanent deletion from inside the app. The mobile client
 * calls this with a Clerk session token in the `Authorization` header, the same
 * way it already calls the import endpoints.
 *
 * The account is always taken from the verified session, never from the body,
 * so this cannot be pointed at someone else's account.
 */

// node:crypto is used for Apple client secret signing in revokeAppleCredentials.
export const runtime = "nodejs";

/** Guards against an accidental or mis-routed POST triggering deletion. */
const CONFIRMATION_PHRASE = "DELETE";

export async function POST(request: NextRequest) {
  const authResult = await requireAuthUserIdForApi();
  if (authResult.response) return authResult.response;
  const { userId } = authResult;

  const body = await request.json().catch(() => null);
  if (body?.confirm !== CONFIRMATION_PHRASE) {
    return NextResponse.json(
      { error: `Confirmation required: send { "confirm": "DELETE" }` },
      { status: 400 }
    );
  }

  try {
    // 1. Storage, recipes, usage, profile cascade, RevenueCat subscriber.
    const report = await deleteAccountData(userId);

    if (report.warnings.length > 0) {
      console.warn("Account deletion completed with warnings", {
        userId,
        warnings: report.warnings,
      });
    }

    // 2. Apple credentials, while Clerk can still hand us the token.
    const revocation = await revokeAppleCredentials(userId);
    if (revocation.status !== "revoked") {
      console.info("Sign in with Apple revocation not completed", {
        userId,
        status: revocation.status,
        reason: revocation.reason,
      });
    }

    // 3. The identity itself, last, so any failure above is retryable.
    const client = await clerkClient();
    await client.users.deleteUser(userId);

    console.info("Account deleted", {
      userId,
      recipesDeleted: report.recipesDeleted,
      storageObjectsRemoved: report.storageObjectsRemoved,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // The user is still signed in and their Clerk account still exists, so the
    // client can surface this and let them try again.
    console.error("Account deletion failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error:
          "We could not finish deleting your account. Nothing was lost — please try again, or contact support if it keeps failing.",
      },
      { status: 500 }
    );
  }
}
