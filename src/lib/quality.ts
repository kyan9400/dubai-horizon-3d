"use client";

/* Quality tier, decided BEFORE the Canvas is created.
   A throwaway WebGL2 context tells us whether 3D works at all and which GPU this is.
   Software renderers get no 3D at all (the poster stays); ?quality=low|medium|high overrides and forces the 3D on. */

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

/** webgl: a WebGL 2 context can be made at all. software: it runs on the CPU, so the 3D is skipped
    (the poster stays) unless ?quality= forces it on. */
export interface Probe {
  webgl: boolean;
  software: boolean;
  forced: boolean;
  tier: Tier;
  gpu: string;
}

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };
const cap = (t: Tier, max: Tier): Tier => (RANK[t] > RANK[max] ? max : t);

/** CPU-only WebGL (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, Mesa offscreen). */
export const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

function makeContext(attrs: WebGLContextAttributes): WebGL2RenderingContext | null {
  try {
    return document.createElement("canvas").getContext("webgl2", attrs);
  } catch {
    return null;
  }
}

/** Cheap: one tiny throwaway context (two if the first is refused), released straight away. Never imports three. */
export function probeGPU(): Probe {
  let forced: string | null = null;
  try {
    forced = new URLSearchParams(window.location.search).get("quality");
  } catch {
    /* ignore */
  }
  const isForced = forced === "low" || forced === "medium" || forced === "high";

  // failIfMajorPerformanceCaveat refuses software rasterisers in most browsers
  let gl = makeContext({ failIfMajorPerformanceCaveat: true, powerPreference: "high-performance" });
  let caveat = false;
  if (!gl) {
    gl = makeContext({ powerPreference: "high-performance" });
    caveat = !!gl;
  }
  if (!gl) return { webgl: false, software: false, forced: isForced, tier: "low", gpu: "" };

  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String((info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "");
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  const software = caveat || SOFTWARE_GPU.test(gpu);

  if (forced === "low" || forced === "medium" || forced === "high") return { webgl: true, software, forced: true, tier: forced, gpu };
  if (software) return { webgl: true, software, forced: false, tier: "low", gpu };

  let tier: Tier = "high";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 8;
  if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (cores <= 4 || memory <= 4) tier = cap(tier, "medium");
  if (window.matchMedia("(pointer: coarse)").matches) tier = cap(tier, "medium");
  if (/intel|uhd|iris|mali|adreno|powervr|radeon\(tm\)|vega \d+ graphics|radeon graphics/i.test(gpu))
    tier = cap(tier, "medium");
  return { webgl: true, software, forced: false, tier, gpu };
}

/** Should the 3D chunk load at all? Software renderers keep the poster unless ?quality= forces 3D. */
export function wants3D(p: Probe) {
  return p.webgl && (!p.software || p.forced);
}
