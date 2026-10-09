import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { motionBootScript } from "@/lib/motion";
import "./globals.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dubai-horizon-3d.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Horizon Tower — Explore a twisting tower in 3D",
  description:
    "Explore Horizon Tower, a fictional 72-level residence in Dubai: choose a level and a home, and move the sun across the sky in real-time 3D. A concept project by Alhassan Alfarran.",
  applicationName: "Horizon Tower",
  authors: [{ name: "Alhassan Alfarran", url: "https://alhassan-portfolio-sigma.vercel.app" }],
  creator: "Alhassan Alfarran",
  keywords: ["3D website", "WebGL", "React Three Fiber", "real estate", "architecture", "Dubai", "portfolio"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
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
