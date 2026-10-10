"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { TIERS, type Tier } from "@/lib/quality";
import { createUniforms } from "./materials";
import { Tower } from "./Tower";
import { World } from "./World";
import { Selection } from "./Selection";
import { CameraRig } from "./CameraRig";

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

/** Compiles every shader behind the poster, then reports ready after the first real frame. */
function WarmUp({ onReady }: { onReady: () => void }) {
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
        pending.current = true;
        invalidate();
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, invalidate]);

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

/** Studio-free environment for glass reflections: code-made light panels, no HDRI download. */
function Reflections({ resolution }: { resolution: number }) {
  return (
    <Environment resolution={resolution} frames={1} background={false}>
      <color attach="background" args={["#56677a"]} />
      <Lightformer form="rect" intensity={1.6} color="#fff1dc" position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#f6c48e" position={[-18, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[40, 4, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#bcd3e6" position={[18, 3, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[40, 6, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#9fb5c9" position={[0, 3, 18]} rotation={[0, Math.PI, 0]} scale={[40, 6, 1]} />
      <Lightformer form="rect" intensity={0.25} color="#c9a77a" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
    </Environment>
  );
}

export default function Scene({ tier, reduced, onReady, onLost }: SceneProps) {
  const t = TIERS[tier];
  const uniforms = useMemo(() => createUniforms(), []);
  const crownRef = useRef<THREE.MeshStandardMaterial>(null);
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState(0);
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
      shadows={t.shadows ? "soft" : false}
      gl={{ antialias: t.antialias, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 34, near: 0.5, far: 1400, position: [-30, 12, 40] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Reflections resolution={t.envRes} />
      <ContextWatch onLost={onLost} />
      {/* the tower first, so its crown material exists when the world binds the sun to it */}
      <Tower uniforms={uniforms} fins={tier !== "low"} shadows={t.shadows} crownRef={crownRef} />
      {step >= 1 && <World uniforms={uniforms} shadows={t.shadows} buildings={t.buildings} crownRef={crownRef} />}
      {step >= 2 && (
        <>
          <Selection uniforms={uniforms} />
          <CameraRig reduced={reduced} revealed={revealed} />
          <AdaptiveResolution cap={t.dpr} />
          <WarmUp onReady={handleReady} />
        </>
      )}
      <Steps step={step} total={2} onNext={nextStep} />
    </Canvas>
  );
}
