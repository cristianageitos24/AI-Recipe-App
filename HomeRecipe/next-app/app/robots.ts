import type { MetadataRoute } from "next";
import { isPreviewDeployment, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (isPreviewDeployment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/", "/sso-callback"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
