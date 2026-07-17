"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEntitlements } from "@/components/EntitlementsProvider";

/** Polls until Pro after Checkout success, then refreshes the dashboard shell. */
export function CheckoutSuccessPoller() {
  const { entitlements, refreshEntitlements } = useEntitlements();
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (entitlements.isPro) {
      router.refresh();
      return;
    }

    const id = window.setInterval(() => {
      attempts.current += 1;
      void refreshEntitlements().then(() => {
        if (attempts.current >= 15) {
          window.clearInterval(id);
        }
      });
    }, 2000);

    return () => window.clearInterval(id);
  }, [entitlements.isPro, refreshEntitlements, router]);

  useEffect(() => {
    if (entitlements.isPro) {
      router.refresh();
    }
  }, [entitlements.isPro, router]);

  return null;
}
