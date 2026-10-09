import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Level not found — Horizon Tower",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main id="main" className="notfound">
      <p className="eyebrow">Error 404 · Level 00</p>
      <h1 className="display">Level not found.</h1>
      <p className="lede lede--center">This floor was never built. The lifts still run to the lobby.</p>
      <Link href="/" className="btn btn--gold">
        Back to the tower
      </Link>
      <p className="notfound-foot">© 2026 Alhassan Alfarran · Concept project — fictional brand.</p>
    </main>
  );
}
