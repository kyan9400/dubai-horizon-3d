"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { explorer } from "@/lib/store";
import { sunAt, type SunState } from "@/lib/sun";
import { createCityMaterial, type SharedUniforms } from "./materials";
import { mulberry32 } from "./geometry";

/* ----------------------------------------------------------------------------
   Sky dome: day → golden hour → blue hour → night, with sun disc and stars.
   ---------------------------------------------------------------------------- */
const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uNight;
uniform float uGolden;
uniform float uSunVis;
varying vec3 vDir;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSunDir), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.25), uGolden);
  col += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12 * uGolden) * uSunVis;
  // city glow on the horizon at night
  col += vec3(0.55, 0.3, 0.14) * uNight * 0.22 * exp(-abs(h) * 14.0);
  // stars
  vec3 p = d * 220.0;
  vec3 cell = floor(p);
  vec3 f = fract(p) - 0.5;
  float r = h3(cell);
  float star = step(0.9965, r) * smoothstep(0.32, 0.0, length(f)) * (0.5 + 0.5 * h3(cell + 4.0));
  col += vec3(0.9, 0.93, 1.0) * star * uNight * smoothstep(0.02, 0.2, h) * 1.4;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const C = (hex: string) => new THREE.Color(hex);
const PAL = {
  dayZen: C("#2f63a8"),
  dayHor: C("#c9d8e2"),
  goldZen: C("#3a4672"),
  goldHor: C("#f29a55"),
  blueZen: C("#121a3a"),
  blueHor: C("#4b4f7a"),
  nightZen: C("#03050c"),
  nightHor: C("#121827"),
  sunWarm: C("#ff9a4d"),
  sunWhite: C("#fff4e2"),
  moon: C("#8fa8d8"),
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function skyColors(s: SunState, zen: THREE.Color, hor: THREE.Color) {
  // day ↔ golden by `golden`, then fade to blue hour and night by `night`
  zen.copy(PAL.dayZen).lerp(PAL.goldZen, s.golden);
  hor.copy(PAL.dayHor).lerp(PAL.goldHor, s.golden);
  const blue = Math.min(1, Math.max(0, (-s.elevation) / 6)) * (1 - s.night);
  tmpA.copy(PAL.blueZen);
  tmpB.copy(PAL.blueHor);
  zen.lerp(tmpA, blue);
  hor.lerp(tmpB, blue);
  zen.lerp(PAL.nightZen, s.night);
  hor.lerp(PAL.nightHor, s.night);
}

interface WorldProps {
  uniforms: SharedUniforms;
  shadows: boolean;
  buildings: number;
  crownRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}

interface SunTargets {
  get: () => RootState;
  sky: THREE.ShaderMaterial;
  fog: THREE.Fog;
  uniforms: SharedUniforms;
  shadows: boolean;
  sun: React.RefObject<THREE.DirectionalLight | null>;
  moon: React.RefObject<THREE.DirectionalLight | null>;
  hemi: React.RefObject<THREE.HemisphereLight | null>;
  crown: React.RefObject<THREE.MeshStandardMaterial | null>;
  quay: React.RefObject<THREE.MeshStandardMaterial | null>;
}

/** Fog + on-change shadow map. Returns a cleanup. */
function attachAtmosphere(get: () => RootState, fog: THREE.Fog, shadows: boolean) {
  const { scene, gl } = get();
  scene.fog = fog;
  if (shadows) {
    gl.shadowMap.autoUpdate = false; // re-rendered only when the sun moves
    gl.shadowMap.needsUpdate = true;
  }
  return () => {
    scene.fog = null;
  };
}

/** Follows the clock in the store: sun + moon + sky + fog + window lights. No React state involved. */
function bindSun(t: SunTargets) {
  const s = {} as SunState;
  const dir = new THREE.Vector3();
  const zen = new THREE.Color();
  const hor = new THREE.Color();
  let lastHour = NaN;

  const apply = () => {
    const { hour } = explorer.get();
    if (hour === lastHour) return;
    lastHour = hour;
    const { scene, gl, invalidate } = t.get();
    sunAt(hour, s);
    const el = (s.elevation * Math.PI) / 180;
    const az = (s.azimuth * Math.PI) / 180;
    // bearing → world: north = -Z, east = +X
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

    skyColors(s, zen, hor);
    const su = t.sky.uniforms;
    (su.uSunDir.value as THREE.Vector3).copy(dir);
    (su.uZenith.value as THREE.Color).copy(zen);
    (su.uHorizon.value as THREE.Color).copy(hor);
    su.uNight.value = s.night;
    su.uGolden.value = s.golden;
    su.uSunVis.value = Math.min(1, Math.max(0, (s.elevation + 2) / 4));
    t.fog.color.copy(hor);

    t.uniforms.uNight.value = s.night;
    t.uniforms.uDay.value = s.day;
    scene.environmentIntensity = 0.1 + 0.95 * s.day;

    const sun = t.sun.current;
    if (sun) {
      sun.position.copy(dir).multiplyScalar(60).add(sun.target.position);
      const warm = 1 - Math.min(1, Math.max(0, (s.elevation - 2) / 28));
      sun.color.copy(PAL.sunWhite).lerp(PAL.sunWarm, warm);
      sun.intensity = 3.2 * s.day * Math.min(1, Math.max(0, (s.elevation + 1) / 5));
    }
    const moon = t.moon.current;
    if (moon) moon.intensity = 0.55 * s.night;
    const hemi = t.hemi.current;
    if (hemi) {
      hemi.color.copy(zen).lerp(PAL.sunWhite, 0.35 * s.day);
      hemi.intensity = 0.25 + 0.7 * s.day;
    }
    if (t.crown.current) t.crown.current.emissiveIntensity = 0.05 + 0.9 * s.night;
    if (t.quay.current) t.quay.current.emissiveIntensity = 1.6 * s.night;
    if (t.shadows) gl.shadowMap.needsUpdate = true;
    invalidate();
  };

  apply();
  return explorer.subscribe(apply);
}

export function World({ uniforms, shadows, buildings, crownRef }: WorldProps) {
  const get = useThree((st) => st.get);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const quayRef = useRef<THREE.MeshStandardMaterial>(null);

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uNight: { value: 0 },
          uGolden: { value: 0 },
          uSunVis: { value: 1 },
        },
      }),
    []
  );
  const fog = useMemo(() => new THREE.Fog("#c9d8e2", 45, 300), []);

  useLayoutEffect(() => attachAtmosphere(get, fog, shadows), [get, fog, shadows]);

  useEffect(
    () =>
      bindSun({ get, sky, fog, uniforms, shadows, sun: sunRef, moon: moonRef, hemi: hemiRef, crown: crownRef, quay: quayRef }),
    [get, sky, fog, uniforms, shadows, crownRef]
  );

  useEffect(() => () => sky.dispose(), [sky]);

  return (
    <>
      <mesh material={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[600, 48, 24]} />
      </mesh>

      <hemisphereLight ref={hemiRef} args={["#c9d8e2", "#b59a72", 0.8]} />
      <directionalLight
        ref={sunRef}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={36}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      <directionalLight ref={moonRef} position={[-30, 40, -20]} color={PAL.moon} intensity={0} />

      <Ground quayRef={quayRef} shadows={shadows} />
      <City uniforms={uniforms} count={buildings} shadows={shadows} />
    </>
  );
}

/* ----------------------------------------------------------------------------
   Ground: desert plain, lagoon, quay ring with promenade lights, causeway.
   ---------------------------------------------------------------------------- */
function Ground({ quayRef, shadows }: { quayRef: React.RefObject<THREE.MeshStandardMaterial | null>; shadows: boolean }) {
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const LAMPS = 72;

  useLayoutEffect(() => {
    const mesh = lampRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < LAMPS; i++) {
      const a = (i / LAMPS) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * 8.35, 0.12, Math.sin(a) * 8.35);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={shadows}>
        <circleGeometry args={[320, 64]} />
        <meshStandardMaterial color="#b9a17a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow={shadows}>
        <circleGeometry args={[8, 96]} />
        <meshStandardMaterial color="#163640" metalness={0.75} roughness={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow={shadows}>
        <ringGeometry args={[8, 8.6, 96]} />
        <meshStandardMaterial color="#d8cbb2" roughness={0.8} />
      </mesh>
      {/* causeway from the podium to the quay, heading south toward the city */}
      <mesh position={[0, 0.07, 5.4]} receiveShadow={shadows}>
        <boxGeometry args={[0.9, 0.1, 6.4]} />
        <meshStandardMaterial color="#d3c6ad" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.005, 30]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 44]} />
        <meshStandardMaterial color="#5d564b" roughness={0.95} />
      </mesh>
      <instancedMesh ref={lampRef} args={[undefined, undefined, LAMPS]} frustumCulled={false}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial ref={quayRef} color="#ffe0b0" emissive="#ffc27a" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  );
}

/* ----------------------------------------------------------------------------
   City: one instanced draw call. Taller and denser to the south ("Downtown").
   ---------------------------------------------------------------------------- */
function City({ uniforms, count, shadows }: { uniforms: SharedUniforms; count: number; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return { g, mat: createCityMaterial(uniforms) };
  }, [uniforms]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = mulberry32(2029);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const tones = ["#d9ccb4", "#c8b89b", "#e6dccb", "#b3a68f", "#9aa3a8", "#d0c3a8"].map((h) => new THREE.Color(h));
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 20) {
      const a = rand() * Math.PI * 2;
      const r = 11 + Math.pow(rand(), 0.7) * 72;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 2.2 && z > 0) continue; // keep the avenue clear
      const south = Math.max(0, z / r); // 1 = due south (+Z)
      const downtown = Math.pow(south, 3) * Math.min(1, Math.max(0, (r - 22) / 20));
      if (rand() > 0.55 + 0.45 * south) continue;
      const tall = rand() < 0.08 + 0.35 * downtown;
      const h = tall ? 3 + rand() * (6 + 12 * downtown) : 0.3 + Math.pow(rand(), 2) * 2.2;
      const w = tall ? 0.8 + rand() * 0.9 : 0.7 + rand() * 1.8;
      const d = tall ? 0.8 + rand() * 0.9 : 0.7 + rand() * 1.8;
      // street grid alignment with a little variation
      q.setFromAxisAngle(up, (rand() < 0.75 ? 0 : Math.PI / 4) + (rand() - 0.5) * 0.1);
      p.set(x, 0, z);
      s.set(w, h, d);
      mesh.setMatrixAt(placed, m.compose(p, q, s));
      mesh.setColorAt(placed, col.copy(tones[Math.floor(rand() * tones.length)]));
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, res]);

  useLayoutEffect(
    () => () => {
      res.g.dispose();
      res.mat.dispose();
    },
    [res]
  );

  return <instancedMesh ref={ref} args={[res.g, res.mat, count]} receiveShadow={shadows} castShadow={false} frustumCulled={false} />;
}
