"use client";

/* A tiny external store shared by the DOM controls and the 3D scene.
   The scene subscribes without React state (no re-render per frame); the controls use useSyncExternalStore. */

import { useSyncExternalStore } from "react";

export interface ExplorerState {
  floor: number;
  /** index into residencesOn(floor), or -1 for none */
  unit: number;
  hour: number;
  playing: boolean;
}

type Listener = () => void;

let state: ExplorerState = { floor: 48, unit: 3, hour: 18.25, playing: false };
const listeners = new Set<Listener>();

export const explorer = {
  get: () => state,
  set(patch: Partial<ExplorerState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useExplorer(): ExplorerState {
  return useSyncExternalStore(explorer.subscribe, explorer.get, explorer.get);
}

/**
 * Subscribe to one derived primitive of the store. The component re-renders only when that value changes, so the
 * "Play a day" clock (which writes the hour every animation frame) does not re-render the level or residence controls.
 */
export function useExplorerValue<T extends string | number | boolean>(select: (s: ExplorerState) => T): T {
  return useSyncExternalStore(
    explorer.subscribe,
    () => select(state),
    () => select(state)
  );
}
