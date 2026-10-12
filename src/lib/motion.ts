"use client";

/* Motion preference.
   Follows prefers-reduced-motion by default, but the visitor can turn full motion back on (many Windows users switch
   animations off for speed, not comfort). The choice is remembered; ?motion=full|reduced overrides for testing.
   The inline script in layout.tsx applies the same logic before first paint, so CSS never flashes. */

import { useSyncExternalStore } from "react";

export const MOTION_KEY = "horizon-motion";

let reduced: boolean | null = null;
const listeners = new Set<() => void>();

function compute(): boolean {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("motion");
    if (fromUrl === "full") return false;
    if (fromUrl === "reduced") return true;
  } catch {
    /* ignore */
  }
  try {
    const saved = localStorage.getItem(MOTION_KEY);
    if (saved === "full") return false;
    if (saved === "reduced") return true;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getReducedMotion(): boolean {
  if (reduced === null) reduced = compute();
  return reduced;
}

export function setFullMotion(full: boolean) {
  reduced = !full;
  try {
    localStorage.setItem(MOTION_KEY, full ? "full" : "reduced");
  } catch {
    /* storage blocked: choice lasts for this page view */
  }
  const root = document.documentElement;
  root.classList.toggle("reduce-motion", !full);
  root.classList.toggle("motion-ok", full);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** true = reduced motion. On the server (and during hydration) we assume reduced, the calm default. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getReducedMotion, () => true);
}

/** Runs before paint (stringified into a <script> in the root layout). */
export const motionBootScript = `(function(){try{var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var s=null;try{s=localStorage.getItem('${MOTION_KEY}')}catch(e){}var u=new URLSearchParams(location.search).get('motion');var c=(u==='full'||u==='reduced')?u:s;if(c==='full')r=false;else if(c==='reduced')r=true;var d=document.documentElement;d.classList.add(r?'reduce-motion':'motion-ok');}catch(e){}})();`;
