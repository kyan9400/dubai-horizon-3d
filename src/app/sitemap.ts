import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Static so the GitHub Pages export can emit it too.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date("2026-10-10"), changeFrequency: "monthly", priority: 1 }];
}
