"use server";

import { auth } from "@clerk/nextjs/server";
import { getEntitlementsForClient } from "@/lib/entitlements";

export async function getMyEntitlements() {
  const { userId } = await auth();
  if (!userId) {
    return {
      error: "Unauthorized" as const,
      data: null,
    };
  }

  const data = await getEntitlementsForClient(userId);
  return { error: null, data };
}
