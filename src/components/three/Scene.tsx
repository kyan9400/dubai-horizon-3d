"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { TIERS, type Tier } from "@/lib/quality";
import { explorer } from "@/lib/store";
import { createUniforms } from "./materials";
import { Tower } from "./Tower";
import { World, createSkyMaterial } from "./World";
import { Selection } from "./Selection";
import { CameraRig } from "./CameraRig";
import { loadSatellite, type SatUniforms } from "./satellite";

export interface SceneProps {
  tier: Tier;
  reduced: boolean;
  onReady: () => void;
  onLost: () => void;
}

/** Let the browser handle input and paint before the next slice of scene work. */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Mounts the scene in slices (tower, then city, then the rest), one per task, so the geometry
 * generation never lands as one long blocking task on a slow phone.
 */
function Steps({ step, total, onNext }: { step: number; total: number; onNext: () => void }) {
  useEffect(() => {
    if (step >= total) return;
    let alive = true;
    yieldToMain().then(() => alive && onNext());
    return () => {
      alive = false;
    };
  }, [step, total, onNext]);
  return null;
}

/**
 * Draws the frame only once the warm-up has compiled the scene. Until then any invalidate (a selection binding, the
 * camera rig) is a no-op, so no frame compiles programs one by one on the main thread while compileAsync is running.
 * (A useFrame with a priority above 0 takes over r3f's own render call.)
 */
function GatedRender({ gate }: { gate: React.RefObject<boolean> }) {
  useFrame((state) => {
    if (gate.current) state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}

/** Compiles every shader behind the poster (in parallel where the browser can), opens the render gate, then reports
    ready after the first real frame. */
function WarmUp({ onReady, gate }: { onReady: () => void; gate: React.RefObject<boolean> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const pending = useRef(false);

  useEffect(() => {
    let alive = true;
    yieldToMain()
      .then(() => (alive ? gl.compileAsync(scene, camera) : undefined))
      .catch(() => undefined)
      .then(() => {
        if (!alive) return;
        gate.current = true;
        pending.current = true;
        invalidate();
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, invalidate, gate]);

  useFrame(() => {
    if (!pending.current) return;
    pending.current = false;
    // reveal on the next frame so the first drawn image is already on screen
    requestAnimationFrame(onReady);
  });
  return null;
}

/**
 * Adaptive resolution for an on-demand renderer: only consecutive frames (a glide, a drag, the time-lapse)
 * are measured. If they are clearly slower than ~45 fps the pixel ratio steps down; it never bounces back up.
 */
function AdaptiveResolution({ cap }: { cap: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ avg: 16.7, n: 0, dpr: Math.min(cap, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1), settle: 0 });
  useFrame((_, delta) => {
    const s = st.current;
    const ms = delta * 1000;
    if (ms < 4 || ms > 80) {
      s.n = 0; // a pause between on-demand frames, not a slow frame
      return;
    }
    s.avg += (ms - s.avg) * 0.08;
    s.n++;
    if (s.settle > 0) {
      s.settle--;
      return;
    }
    if (s.n > 40 && s.avg > 22 && s.dpr > 0.75) {
      s.dpr = Math.max(0.75, s.dpr - 0.25);
      setDpr(s.dpr);
      s.settle = 40;
      s.avg = 16.7;
    }
  });
  return null;
}

function ContextWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}

/**
 * Reflections of the real sky: the sky dome itself (plus two soft panels for highlights on the glass) is drawn into a
 * cube render target that becomes `scene.environment` (no HDRI download). The cube (6 passes + the PMREM blur three
 * runs on it) is re-rendered only when the time of day changes, at most ~8 times a second while it is scrubbed or
 * playing, never on frames that only move the camera.
 */
interface EnvRig {
  fbo: THREE.WebGLCubeRenderTarget;
  cam: THREE.CubeCamera;
  virtual: THREE.Scene;
  dispose: () => void;
}
interface EnvState {
  dirty: boolean;
  hour: number;
  last: number;
}

function createEnvRig(resolution: number, sky: THREE.ShaderMaterial): EnvRig {
  const fbo = new THREE.WebGLCubeRenderTarget(resolution, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.1, 1000, fbo);
  const virtual = new THREE.Scene();
  const dome = new THREE.SphereGeometry(400, 32, 16);
  const plane = new THREE.PlaneGeometry(1, 1);
  const panel = (hex: string, intensity: number, y: number, rx: number, size: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(plane, m);
    mesh.position.set(0, y, 0);
    mesh.rotation.set(rx, 0, 0);
    mesh.scale.set(size, size, 1);
    return mesh;
  };
  // the two soft panels drei's <Lightformer>s used to add: a warm overhead light and a sand bounce
  const panels = [panel("#fff1dc", 0.6, 30, Math.PI / 2, 30), panel("#c9a77a", 0.35, -8, -Math.PI / 2, 60)];
  virtual.add(new THREE.Mesh(dome, sky), cam, ...panels);
  return {
    fbo,
    cam,
    virtual,
    dispose() {
      fbo.dispose();
      dome.dispose();
      plane.dispose();
      panels.forEach((p) => (p.material as THREE.Material).dispose());
    },
  };
}

/** Uses the cube as the scene environment. Returns a cleanup. */
function attachEnv(get: () => RootState, rig: EnvRig) {
  const { scene } = get();
  const prev = scene.environment;
  scene.environment = rig.fbo.texture;
  return () => {
    scene.environment = prev;
    rig.dispose();
  };
}

/** Six cube faces of the sky; three re-runs its PMREM blur on the next use because the cube changed. */
function drawEnv(get: () => RootState, rig: EnvRig, s: EnvState) {
  const { gl } = get();
  s.dirty = false;
  s.last = performance.now();
  s.hour = explorer.get().hour;
  const autoClear = gl.autoClear;
  gl.autoClear = true;
  rig.cam.update(gl, rig.virtual);
  gl.autoClear = autoClear;
}

/**
 * Reflections of the real sky: the sky dome itself (plus two soft panels for highlights on the glass) is drawn into a
 * cube render target that becomes `scene.environment` (no HDRI download). The cube (6 passes + the PMREM blur three
 * runs on it) is re-rendered only when the time of day changes, at most ~8 times a second while it is scrubbed or
 * playing, never on frames that only move the camera.
 */
function Reflections({ resolution, sky, active }: { resolution: number; sky: THREE.ShaderMaterial; active: boolean }) {
  const get = useThree((s) => s.get);
  const rig = useMemo(() => createEnvRig(resolution, sky), [resolution, sky]);
  const st = useRef<EnvState>({ dirty: true, hour: NaN, last: -1e9 });

  useLayoutEffect(() => attachEnv(get, rig), [get, rig]);

  useEffect(
    () =>
      explorer.subscribe(() => {
        if (explorer.get().hour !== st.current.hour) st.current.dirty = true;
      }),
    []
  );

  // first draw as soon as the scene is complete (the sun is bound by then) and before the warm-up compiles the
  // materials, so they are compiled once, with the final environment map
  useLayoutEffect(() => {
    if (active) drawEnv(get, rig, st.current);
  }, [active, get, rig]);

  // default priority: runs before r3f draws the frame, so the new reflection is in this very frame
  useFrame((state) => {
    const s = st.current;
    if (!active || !s.dirty) return;
    if (performance.now() - s.last < 120) {
      state.invalidate(); // throttled: come back next frame so the final hour is always captured
      return;
    }
    drawEnv(get, rig, s);
  });
  return null;
}

export default function Scene({ tier, reduced, onReady, onLost }: SceneProps) {
  const t = TIERS[tier];
  const uniforms = useMemo(() => createUniforms(), []);
  const sky = useMemo(() => createSkyMaterial(uniforms), [uniforms]);
  useEffect(() => () => sky.dispose(), [sky]);
  const crownRef = useRef<THREE.MeshStandardMaterial>(null);
  // the real coast imagery loads with the 3D chunk; the world is mounted (and compiled) once it is here
  const [sat, setSat] = useState<SatUniforms | null>(null);
  useEffect(() => {
    let alive = true;
    loadSatellite(tier === "high").then((s) => alive && setSat(s));
    return () => {
      alive = false;
    };
  }, [tier]);
  useEffect(
    () => () => {
      sat?.uSat.value.dispose();
      sat?.uSatMask.value.dispose();
    },
    [sat]
  );
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState(0);
  const gate = useRef(false);
  const nextStep = useCallback(() => setStep((n) => n + 1), []);
  const handleReady = useCallback(() => {
    setRevealed(true);
    onReady();
  }, [onReady]);

  return (
    <Canvas
      className="scene-canvas"
      frameloop="demand"
      dpr={[1, t.dpr]}
      shadows={t.shadows ? "percentage" : false}
      gl={{ antialias: t.antialias, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 34, near: 0.5, far: 2000, position: [60, 26, 26] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
      }}
    >
      <Reflections resolution={t.envRes} sky={sky} active={step >= 2} />
      <ContextWatch onLost={onLost} />
      {/* Hidden until every slice is mounted: nothing is drawn (and no shader is compiled) with a half-built light
          setup, so each program is compiled once, together, by the warm-up instead of twice. */}
      <group visible={step >= 2}>
        {/* the tower first, so its crown material exists when the world binds the sun to it */}
        <Tower uniforms={uniforms} fins={tier !== "low"} shadows={t.shadows} crownRef={crownRef} />
        {step >= 1 && sat && (
          <World uniforms={uniforms} sky={sky} shadows={t.shadows} buildings={t.buildings} crownRef={crownRef} sat={sat} />
        )}
      </group>
      {step >= 2 && (
        <>
          <Selection uniforms={uniforms} />
          <CameraRig reduced={reduced} revealed={revealed} />
          <AdaptiveResolution cap={t.dpr} />
          <WarmUp onReady={handleReady} gate={gate} />
        </>
      )}
      <GatedRender gate={gate} />
      <Steps step={step} total={sat ? 2 : 1} onNext={nextStep} />
    </Canvas>
  );
}
