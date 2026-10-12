import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { motionBootScript } from "@/lib/motion";
import { AUTHOR, METADATA_BASE, PORTFOLIO_URL, SITE_URL } from "@/lib/site";
import "./globals.css";

// Both are variable fonts: one file per style covers every weight the CSS uses.
const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE),
  title: "Horizon Tower — Explore a twisting tower in 3D",
  description:
    "Explore Horizon Tower, a fictional 72-level residence in Dubai: choose a level and a home, and move the sun across the sky in real-time 3D. A concept project by Alhassan Alfarran.",
  applicationName: "Horizon Tower",
  authors: [{ name: AUTHOR, url: PORTFOLIO_URL }],
  creator: AUTHOR,
  keywords: ["3D website", "WebGL", "React Three Fiber", "real estate", "architecture", "Dubai", "portfolio"],
  // absolute so the Pages mirror also points search engines at the main site
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    siteName: "Horizon Tower",
    title: "Horizon Tower — Seventy-two levels. One turning horizon.",
    description: "A procedural tower you can explore: pick a level, a residence, and the time of day. Concept project — fictional brand.",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Horizon Tower — Seventy-two levels. One turning horizon.",
    description: "A procedural tower you can explore in real-time 3D. Concept project — fictional brand.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0C11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
