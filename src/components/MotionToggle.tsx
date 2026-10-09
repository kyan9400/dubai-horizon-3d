"use client";

import { setFullMotion, useReducedMotion } from "@/lib/motion";

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
      <span className="motion-label-long">{reduced ? "Turn on full motion" : "Reduce motion"}</span>
      <span className="motion-label-short" aria-hidden="true">
        {reduced ? "Motion" : "Calm"}
      </span>
    </button>
  );
}
