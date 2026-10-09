"use client";

/* Quality tier, decided BEFORE the Canvas is created.
   A throwaway WebGL2 context tells us whether 3D works at all and which GPU this is. */

export type Tier = "high" | "medium" | "low";

export interface TierSettings {
  dpr: number;
  antialias: boolean;
  shadows: boolean;
  buildings: number;
  envRes: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { dpr: 2, antialias: true, shadows: true, buildings: 520, envRes: 256 },
  medium: { dpr: 1.5, antialias: true, shadows: false, buildings: 320, envRes: 128 },
  low: { dpr: 1, antialias: false, shadows: false, buildings: 140, envRes: 64 },
};

export interface Probe {
  webgl: boolean;
  tier: Tier;
  gpu: string;
}

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };
const cap = (t: Tier, max: Tier): Tier => (RANK[t] > RANK[max] ? max : t);

export function probeGPU(): Probe {
  let forced: string | null = null;
  try {
    forced = new URLSearchParams(window.location.search).get("quality");
  } catch {
    /* ignore */
  }

  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = document.createElement("canvas").getContext("webgl2", { powerPreference: "high-performance" });
  } catch {
    gl = null;
  }
  if (!gl) return { webgl: false, tier: "low", gpu: "" };

  let gpu = String(gl.getParameter(gl.RENDERER) || "");
  if (/^webkit/i.test(gpu) || !gpu) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || gpu);
  }
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  if (forced === "low" || forced === "medium" || forced === "high") return { webgl: true, tier: forced, gpu };

  let tier: Tier = "high";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 8;
  if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (cores <= 4 || memory <= 4) tier = cap(tier, "medium");
  if (window.matchMedia("(pointer: coarse)").matches) tier = cap(tier, "medium");
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) tier = "low";
  else if (/intel|uhd|iris|mali|adreno|powervr|radeon\(tm\)|vega \d+ graphics|radeon graphics/i.test(gpu))
    tier = cap(tier, "medium");
  return { webgl: true, tier, gpu };
}
