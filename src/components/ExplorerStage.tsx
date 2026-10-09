"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore } from "react";
import { probeGPU, type Probe } from "@/lib/quality";
import { useReducedMotion } from "@/lib/motion";
import { TowerPoster } from "./TowerPoster";

// The 3D chunk (three + r3f + drei) loads only in the browser, after the page is interactive.
const Scene = dynamic(() => import("./three/Scene"), { ssr: false, loading: () => null });

let probeCache: Probe | null = null;
const getProbe = () => (probeCache ??= probeGPU());
const noop = () => () => {};

export function ExplorerStage() {
  const probe = useSyncExternalStore(noop, getProbe, () => null);
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => setLost(true), []);

  const fallback = probe !== null && (!probe.webgl || lost);
  const live = probe?.webgl && !lost;

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
