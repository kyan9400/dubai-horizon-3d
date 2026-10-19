import type { NextConfig } from "next";

// GH_PAGES=1 builds a static mirror for GitHub Pages (served under /dubai-horizon-3d).
const isPages = process.env.GH_PAGES === "1";
const PAGES_BASE = "/dubai-horizon-3d";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // lets client code build /public URLs that also work under the Pages base path
  env: { NEXT_PUBLIC_PORTFOLIO_URL: isPages ? "https://kyan9400.github.io/alhassan_portfolio/" : "https://alhassan-portfolio-sigma.vercel.app", NEXT_PUBLIC_BASE_PATH: isPages ? PAGES_BASE : "" },
  ...(isPages
    ? {
        output: "export",
        basePath: PAGES_BASE,
        assetPrefix: PAGES_BASE,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        // score-neutral hardening; no CSP because the motion boot script is inline
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
