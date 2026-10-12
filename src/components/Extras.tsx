"use client";

/* Desktop extras that first paint doesn't need. Their code loads after window "load" + idle, in its own chunk. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SectionDots = dynamic(() => import("./SectionDots"), { ssr: false, loading: () => null });

const WIDE = "(min-width: 1100px)";

export function Extras() {
  // true once idle and the screen is wide enough for the dots (narrow screens never fetch them)
  const [dots, setDots] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    let idle = false;
    let idleId = 0;
    let timeoutId = 0;
    const sync = () => {
      if (idle) setDots(mq.matches);
    };
    const run = () => {
      idle = true;
      sync();
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(run, { timeout: 2500 });
      else timeoutId = window.setTimeout(run, 1200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    mq.addEventListener("change", sync);
    return () => {
      window.removeEventListener("load", schedule);
      mq.removeEventListener("change", sync);
      if (idleId) window.cancelIdleCallback(idleId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return dots ? <SectionDots /> : null;
}
