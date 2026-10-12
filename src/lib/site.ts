/** Shared site constants (server-safe). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dubai-horizon-3d.vercel.app";
export const PORTFOLIO_URL = "https://alhassan-portfolio-sigma.vercel.app";
export const AUTHOR = "Alhassan Alfarran";

/** Page sections, in order (header nav, mobile menu and section dots). */
export const SECTIONS = [
  { id: "explore", label: "Explore" },
  { id: "tower", label: "Tower" },
  { id: "residences", label: "Residences" },
  { id: "amenities", label: "Amenities" },
  { id: "location", label: "Location" },
  { id: "enquire", label: "Private viewings" },
] as const;

/** GitHub Pages mirror (static export under /dubai-horizon-3d, built with GH_PAGES=1). */
export const PAGES_URL = "https://kyan9400.github.io/dubai-horizon-3d";
/** Origin that file-based OG/Twitter images resolve against (basePath is added by Next). */
export const METADATA_BASE = process.env.GH_PAGES === "1" ? "https://kyan9400.github.io" : SITE_URL;
