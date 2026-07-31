import "server-only";

import { auth } from "@clerk/nextjs/server";
import { isUserPro, planLimitError } from "@/lib/entitlements";

export type PremiumAccessResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      error: string;
      code?: "PLAN_LIMIT";
      reason?: "planning";
    };

export async function requirePremiumPlanningAccess(): Promise<PremiumAccessResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };
  if (await isUserPro(userId)) return { ok: true, userId };

  const limit = planLimitError("planning");
  return {
    ok: false,
    error: limit.error,
    code: limit.code,
    reason: "planning",
  };
}
