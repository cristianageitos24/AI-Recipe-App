import "server-only";

import { createPrivateKey, sign as signWithKey } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Best-effort Sign in with Apple credential revocation for account deletion.
 *
 * Apple asks apps that offer Sign in with Apple to call `/auth/revoke` when a
 * user deletes their account. Clerk does not do this for us on `deleteUser`,
 * and with the native flow Clerk may hold no Apple token at all — so this is
 * genuinely best-effort.
 *
 * Apple's own technote (TN3194) accepts that the account deletion requirement
 * is still met when no token is available, provided the user's data is erased.
 * The visible consequence of skipping revocation is that a returning user is
 * not re-prompted to share their name and email. That is why nothing here
 * throws: deletion must never fail because revocation could not run.
 *
 * Configure to enable (all four, server-side only):
 *   APPLE_SIWA_CLIENT_ID   — App ID / bundle id, e.g. com.ageitosdigital.homerecipe
 *   APPLE_SIWA_TEAM_ID     — Apple Developer team id
 *   APPLE_SIWA_KEY_ID      — key id of the Sign in with Apple private key
 *   APPLE_SIWA_PRIVATE_KEY — the .p8 contents (literal \n escapes are accepted)
 */

const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

/** Apple caps client secret lifetime at 6 months; we only need seconds. */
const CLIENT_SECRET_TTL_SECONDS = 300;

export type AppleRevocationResult =
  | { status: "revoked" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

type AppleCredentials = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

function readCredentials(): AppleCredentials | null {
  const clientId = process.env.APPLE_SIWA_CLIENT_ID;
  const teamId = process.env.APPLE_SIWA_TEAM_ID;
  const keyId = process.env.APPLE_SIWA_KEY_ID;
  // Deployment platforms commonly store PEM newlines escaped.
  const privateKey = process.env.APPLE_SIWA_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { clientId, teamId, keyId, privateKey };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Apple's client secret is an ES256 JWT signed with the Sign in with Apple
 * key. Node can produce the raw R||S signature JWT requires via the
 * `ieee-p1363` DSA encoding, so this needs no JWT dependency.
 */
function createClientSecret(credentials: AppleCredentials): string {
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", kid: credentials.keyId, typ: "JWT" };
  const payload = {
    iss: credentials.teamId,
    iat: issuedAt,
    exp: issuedAt + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: credentials.clientId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;

  const signature = signWithKey(
    "sha256",
    Buffer.from(signingInput),
    {
      key: createPrivateKey(credentials.privateKey),
      dsaEncoding: "ieee-p1363",
    }
  );

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Revoke the user's Apple tokens. Never throws — inspect the returned status.
 * Call before deleting the Clerk user, while the token is still retrievable.
 */
export async function revokeAppleCredentials(
  userId: string
): Promise<AppleRevocationResult> {
  const credentials = readCredentials();
  if (!credentials) {
    return { status: "skipped", reason: "Apple revocation is not configured" };
  }

  try {
    const client = await clerkClient();
    const tokens = await client.users.getUserOauthAccessToken(userId, "apple");
    const accessToken = tokens.data[0]?.token;

    if (!accessToken) {
      return {
        status: "skipped",
        reason: "no Apple token on file for this user",
      };
    }

    const response = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: createClientSecret(credentials),
        token: accessToken,
        token_type_hint: "access_token",
      }),
      cache: "no-store",
    });

    // Apple returns 200 with no body on success, including for a token that
    // was already invalidated.
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "failed",
        reason: `Apple responded ${response.status}${detail ? `: ${detail}` : ""}`,
      };
    }

    return { status: "revoked" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
