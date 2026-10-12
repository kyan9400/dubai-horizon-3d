"use client";

/* Right-edge section dots (>= 1100px, CSS). One IntersectionObserver marks the section in the middle of the
   viewport; only the dot's transform and opacity change. */

import { useEffect, useState } from "react";
import { SECTIONS } from "@/lib/site";

export default function SectionDots() {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav className="section-dots" aria-label="Page sections">
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-label={s.label} aria-current={current === s.id ? "true" : undefined}>
              <span className="section-dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
