import type { MetadataRoute } from "next";
import { isPreviewDeployment, SITE_URL, sitePath } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreviewDeployment()) {
    return [];
  }

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: sitePath("/privacy"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
