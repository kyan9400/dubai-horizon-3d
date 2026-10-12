"use client";

import { setFullMotion, useReducedMotion } from "@/lib/motion";

/* Both labels are always in the HTML and stacked in one grid cell; CSS shows the one that matches the html class
   the boot script sets before first paint. So the button never changes width or text after hydration. */
export function MotionToggle() {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-pressed={!reduced}
      onClick={() => setFullMotion(reduced)}
    >
      <span className="motion-dot" aria-hidden="true" />
      <span className="motion-label-long ml">
        <span className="ml-on">Reduce motion</span>
        <span className="ml-off">Turn on full motion</span>
      </span>
      <span className="motion-label-short ml" aria-hidden="true">
        <span className="ml-on">Calm</span>
        <span className="ml-off">Motion</span>
      </span>
    </button>
  );
}
