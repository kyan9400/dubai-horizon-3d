import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Static so the GitHub Pages export can emit it too.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
