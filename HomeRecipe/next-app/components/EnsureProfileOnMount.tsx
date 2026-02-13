"use client";

import { useEffect } from "react";
import { ensureProfile } from "@/app/actions/profiles";

/**
 * Calls ensureProfile on mount. Used to avoid awaiting it in the dashboard layout,
 * which helps prevent the "Rendered more hooks than during the previous render" error
 * during the auth redirect flow.
 */
export function EnsureProfileOnMount() {
  useEffect(() => {
    ensureProfile();
  }, []);
  return null;
}
