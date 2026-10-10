"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { probeGPU, wants3D, type Probe } from "@/lib/quality";
import { useReducedMotion } from "@/lib/motion";
import { TowerPoster } from "./TowerPoster";

// The 3D chunk (three + r3f + drei) loads only in the browser, after window "load" plus an idle callback
// (never during hydration), and never on a software renderer, which keeps the poster.
const Scene = dynamic(() => import("./three/Scene"), { ssr: false, loading: () => null });

export function ExplorerStage() {
  const [probe, setProbe] = useState<Probe | null>(null);

  // probe the GPU (a throwaway context, no three import) once the page has loaded and the main thread is idle
  useEffect(() => {
    let idleId = 0;
    let timeoutId = 0;
    const run = () => setProbe(probeGPU());
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(run, { timeout: 2500 });
      else timeoutId = window.setTimeout(run, 1200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId) window.cancelIdleCallback(idleId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => setLost(true), []);

  // no WebGL or a lost context: say so. A software renderer just keeps the poster (the page works the same).
  const fallback = probe !== null && (!probe.webgl || lost);
  const live = probe !== null && wants3D(probe) && !lost;

  return (
    <div className="stage" id="stage" data-ready={ready && !lost ? "true" : "false"}>
      <TowerPoster className="stage-poster" />
      {live && (
        <div
          className="stage-canvas"
          role="img"
          aria-label="Interactive 3D model of Horizon Tower. Drag to turn it; use the level, residence and time controls to explore."
        >
          <Scene tier={probe.tier} reduced={reduced} onReady={onReady} onLost={onLost} />
        </div>
      )}
      <div className="stage-status" aria-live="polite">
        {live && !ready && <span className="stage-chip">Composing the skyline…</span>}
        {fallback && (
          <span className="stage-chip stage-chip--note">
            Interactive 3D is not available on this device. The residence finder still works.
          </span>
        )}
        {live && ready && <span className="stage-hint" aria-hidden="true">Drag to turn the tower</span>}
      </div>
    </div>
  );
}
