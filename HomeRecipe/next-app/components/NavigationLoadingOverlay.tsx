"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";

const MIN_DISPLAY_MS = 4000;

function isInternalLink(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const anchor = target.closest("a");
  if (!anchor || !anchor.href) return false;
  try {
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return false;
    if (anchor.target === "_blank") return false;
    if (anchor.getAttribute("href")?.startsWith("/") !== true) return false;
    return true;
  } catch {
    return false;
  }
}

function shouldHandleClick(e: MouseEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.shiftKey && isInternalLink(e.target);
}

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [showOverlay, setShowOverlay] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const previousPathnameRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideAfterMinDelay = useCallback(() => {
    if (startTimeRef.current === null) return;
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = MIN_DISPLAY_MS - elapsed;
    startTimeRef.current = null;

    if (remaining > 0) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setShowOverlay(false);
      }, remaining);
    } else {
      setShowOverlay(false);
    }
  }, []);

  // When pathname changes, navigation is done; wait for min delay then hide
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (previousPathnameRef.current !== null && showOverlay) {
        hideAfterMinDelay();
      }
      previousPathnameRef.current = pathname;
    }
  }, [pathname, showOverlay, hideAfterMinDelay]);

  // Listen for clicks on internal links to show overlay
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!shouldHandleClick(e)) return;
      startTimeRef.current = Date.now();
      setShowOverlay(true);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!showOverlay) return null;

  return <LoadingScreen />;
}
