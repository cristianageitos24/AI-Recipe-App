import type { Metadata } from "next";

/** Production origin for Google-facing URLs. Never use VERCEL_URL here. */
export const SITE_URL = "https://homerecipe.co";
export const SITE_NAME = "HomeRecipe";
export const SITE_DESCRIPTION =
  "Simple and tasty recipes. Search, save, and plan your meals.";
export const SITE_EMAIL = "cristian@ageitosdigital.com";
export const SITE_LOGO_PATH = "/images/homerecipelogo1.png";

export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function sitePath(path: string = "/"): string {
  if (path === "/" || path === "") return SITE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function publicRobots(): Metadata["robots"] {
  if (isPreviewDeployment()) {
    return {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, nocache: true },
    };
  }
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  };
}

export function noIndexRobots(): Metadata["robots"] {
  return {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, nocache: true },
  };
}
