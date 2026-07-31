"use server";

import { getAuthUserId } from "@/lib/auth";
import { getEntitlementsForClient } from "@/lib/entitlements";

export async function getMyEntitlements() {
  const userId = await getAuthUserId();
  if (!userId) {
    return {
      error: "Unauthorized" as const,
      data: null,
    };
  }

  const data = await getEntitlementsForClient(userId);
  return { error: null, data };
}
