"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { explorer } from "@/lib/store";
import { sunAt, type SunState } from "@/lib/sun";
import { HEAD, SKY_GLSL, createCityMaterial, createGroundMaterial, type SharedUniforms } from "./materials";
import { mulberry32 } from "./geometry";
import type { SatUniforms } from "./satellite";

/* ----------------------------------------------------------------------------
   Sky dome: day → golden hour → blue hour → night, with sun disc, cirrus and stars.
   The same material is drawn into the reflection cube, so the glass mirrors the real sky.
   ---------------------------------------------------------------------------- */
const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFragment = /* glsl */ `
${HEAD}
${SKY_GLSL}
varying vec3 vDir;
void main() {
  gl_FragColor = vec4(hzSky(normalize(vDir), 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSkyMaterial(u: SharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: u,
  });
}

const C = (hex: string) => new THREE.Color(hex);
const PAL = {
  dayZen: C("#2a68b4"),
  dayHor: C("#cfdbe2"),
  goldZen: C("#2a3868"),
  goldHor: C("#f3a25e"),
  blueZen: C("#0f1736"),
  blueHor: C("#4e4f7c"),
  nightZen: C("#02040b"),
  nightHor: C("#121827"),
  sunWarm: C("#ff9446"),
  sunWhite: C("#fff4e2"),
  moon: C("#8fa8d8"),
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function skyColors(s: SunState, zen: THREE.Color, hor: THREE.Color) {
  // day ↔ golden by `golden`, then fade to blue hour and night by `night`
  zen.copy(PAL.dayZen).lerp(PAL.goldZen, s.golden);
  hor.copy(PAL.dayHor).lerp(PAL.goldHor, s.golden);
  const blue = Math.min(1, Math.max(0, -s.elevation / 6)) * (1 - s.night);
  tmpA.copy(PAL.blueZen);
  tmpB.copy(PAL.blueHor);
  zen.lerp(tmpA, blue);
  hor.lerp(tmpB, blue);
  zen.lerp(PAL.nightZen, s.night);
  hor.lerp(PAL.nightHor, s.night);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface WorldProps {
  uniforms: SharedUniforms;
  sky: THREE.ShaderMaterial;
  shadows: boolean;
  buildings: number;
  crownRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  sat: SatUniforms;
}

interface SunTargets {
  get: () => RootState;
  fog: THREE.Fog;
  uniforms: SharedUniforms;
  shadows: boolean;
  sun: React.RefObject<THREE.DirectionalLight | null>;
  moon: React.RefObject<THREE.DirectionalLight | null>;
  fill: React.RefObject<THREE.DirectionalLight | null>;
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
  const zen = new THREE.Color();
  const hor = new THREE.Color();
  let lastHour = NaN;
  const u = t.uniforms;

  const apply = () => {
    const { hour } = explorer.get();
    if (hour === lastHour) return;
    lastHour = hour;
    const { scene, gl, invalidate } = t.get();
    sunAt(hour, s);
    const el = (s.elevation * Math.PI) / 180;
    const az = (s.azimuth * Math.PI) / 180;
    // bearing → world: north = -Z, east = +X
    const dir = u.uSunDir.value;
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

    skyColors(s, zen, hor);
    u.uZenith.value.copy(zen);
    u.uHorizon.value.copy(hor);
    // the haze is the horizon colour pulled a little toward the zenith, so the distance reads as air, not paint
    u.uFogC.value.copy(hor).lerp(zen, 0.22).multiplyScalar(0.92);
    u.uGolden.value = s.golden;
    u.uSunVis.value = Math.min(1, Math.max(0, (s.elevation + 2) / 4));
    t.fog.color.copy(u.uFogC.value);

    u.uNight.value = s.night;
    u.uDay.value = s.day;
    u.uLights.value = Math.max(s.night, 1 - smooth(-6, 12, s.elevation));
    scene.environmentIntensity = 1;

    const sun = t.sun.current;
    if (sun) {
      sun.position.copy(dir).multiplyScalar(60).add(sun.target.position);
      const warm = 1 - Math.min(1, Math.max(0, (s.elevation - 2) / 28));
      sun.color.copy(PAL.sunWhite).lerp(PAL.sunWarm, warm);
      sun.intensity = 3.6 * s.day * Math.min(1, Math.max(0, (s.elevation + 1) / 5));
    }
    const moon = t.moon.current;
    if (moon) moon.intensity = 0.5 * s.night;
    const fill = t.fill.current;
    if (fill) fill.intensity = 0.15 + 0.5 * s.day;
    const hemi = t.hemi.current;
    if (hemi) {
      hemi.color.copy(zen).lerp(PAL.sunWhite, 0.35 * s.day);
      hemi.intensity = 0.2 + 0.6 * s.day;
    }
    if (t.crown.current) t.crown.current.emissiveIntensity = 0.05 + 1.3 * u.uLights.value;
    if (t.quay.current) t.quay.current.emissiveIntensity = 2.2 * u.uLights.value;
    if (t.shadows) gl.shadowMap.needsUpdate = true;
    invalidate();
  };

  apply();
  return explorer.subscribe(apply);
}

export function World({ uniforms, sky, shadows, buildings, crownRef, sat }: WorldProps) {
  const get = useThree((st) => st.get);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const quayRef = useRef<THREE.MeshStandardMaterial>(null);

  // pushed back far enough that the real coastline (Palm Jumeirah, the shore) still reads through the haze
  const fog = useMemo(() => new THREE.Fog("#c9d8e2", 130, 1500), []);

  useLayoutEffect(() => attachAtmosphere(get, fog, shadows), [get, fog, shadows]);

  useEffect(
    () =>
      bindSun({
        get,
        fog,
        uniforms,
        shadows,
        sun: sunRef,
        moon: moonRef,
        fill: fillRef,
        hemi: hemiRef,
        crown: crownRef,
        quay: quayRef,
      }),
    [get, fog, uniforms, shadows, crownRef]
  );

  return (
    <>
      <mesh material={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[600, 48, 24]} />
      </mesh>

      <hemisphereLight ref={hemiRef} args={["#c9d8e2", "#8a6f4e", 0.8]} />
      <directionalLight
        ref={sunRef}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={38}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
      {/* cool sky fill from the east, so the shaded faces keep their form at golden hour */}
      <directionalLight ref={fillRef} position={[40, 30, 20]} color="#9db4d6" intensity={0.4} />
      <directionalLight ref={moonRef} position={[-30, 40, -20]} color={PAL.moon} intensity={0} />

      <Ground uniforms={uniforms} quayRef={quayRef} shadows={shadows} sat={sat} />
      <City uniforms={uniforms} count={buildings} shadows={shadows} />
    </>
  );
}

/* ----------------------------------------------------------------------------
   Layout (mirrors LAYOUT_GLSL): Gulf to the west, a winding creek north of the quay,
   the round lagoon around the podium. Used to keep buildings on dry land.
   ---------------------------------------------------------------------------- */
const seaEdge = (z: number) => -62 + 9 * Math.sin(z * 0.021 + 0.6) + 4 * Math.sin(z * 0.057);
const creekZ = (x: number) => -15 + 6 * Math.sin(x * 0.045 + 1) + 3 * Math.sin(x * 0.11);
const creekW = (x: number) => (1.5 + 2.6 * smooth(0, -60, x)) * smooth(78, 58, x);
function waterD(x: number, z: number) {
  const sea = x - seaEdge(z);
  const creek = Math.abs(z - creekZ(x)) - creekW(x);
  const lagoon = Math.hypot(x, z) - 8;
  return Math.min(sea, creek, lagoon);
}

/* ----------------------------------------------------------------------------
   Ground: one shader plane (city blocks, roads, beach, Gulf, creek, lagoon around the quay; the real coast from NASA
   Landsat imagery beyond it) + quay lamps.
   ---------------------------------------------------------------------------- */
function Ground({
  uniforms,
  quayRef,
  shadows,
  sat,
}: {
  uniforms: SharedUniforms;
  quayRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  shadows: boolean;
  sat: SatUniforms;
}) {
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const LAMPS = 72;
  const gl = useThree((st) => st.gl);
  const mat = useMemo(() => createGroundMaterial(uniforms, sat), [uniforms, sat]);
  useEffect(() => () => mat.dispose(), [mat]);

  // upload the imagery now (sharp at grazing angles), so the first revealed frame does not stall on it
  useLayoutEffect(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const t of [sat.uSat.value, sat.uSatMask.value]) {
      t.anisotropy = aniso;
      gl.initTexture(t);
    }
  }, [gl, sat]);

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={shadows} material={mat}>
        <circleGeometry args={[1300, 96]} />
      </mesh>
      <instancedMesh ref={lampRef} args={[undefined, undefined, LAMPS]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial ref={quayRef} color="#ffe0b0" emissive="#ffc27a" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  );
}

/* ----------------------------------------------------------------------------
   City: three instanced draw calls (blocks, round towers, stepped towers), laid out on a 6-unit street grid
   in 2 × 2 lots per block. Downtown (south) and a marina skyline on the Gulf get the tall glass towers;
   the old quarter across the creek stays low and stone-coloured.
   ---------------------------------------------------------------------------- */
const DOWNTOWN = { x: 6, z: 40, r: 22 };
const MARINA = { x: -44, z: 26, r: 15 };
const STONE = ["#e8e0d2", "#d8c9b0", "#c9b89c", "#b8aa93", "#ece6dc", "#a89c8a"].map(C);
const GLASS = ["#b4cad4", "#cfdbe2", "#d6c4a6", "#a2b4c2", "#e2e8ec", "#b6d2ce"].map(C);

interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  type: 0 | 1 | 2;
  glass: number;
  tint: THREE.Color;
  rot: number;
  score: number;
}

function planCity(count: number): Lot[] {
  const rand = mulberry32(2029);
  const lots: Lot[] = [];
  const R = 92;
  for (let bx = -16; bx <= 16; bx++) {
    for (let bz = -16; bz <= 16; bz++) {
      // a tall tower may take the whole block
      const cx = bx * 6;
      const cz = bz * 6;
      const dDown = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.z) / DOWNTOWN.r;
      const dMar = Math.hypot(cx - MARINA.x, cz - MARINA.z) / MARINA.r;
      const core = Math.max(0, 1 - Math.min(dDown, dMar));
      const rb = Math.hypot(cx, cz);
      if (rb < 13 || rb > R) continue;
      if (core > 0.15 && rand() < 0.35 + 0.5 * core && waterD(cx, cz) > 4.5 && Math.abs(cx) > 3.5) {
        const h = 5 + rand() * (5 + 12 * core);
        const w = 2.2 + rand() * 1.4;
        const type = (rand() < 0.45 ? 2 : rand() < 0.5 ? 1 : 0) as 0 | 1 | 2;
        lots.push({
          x: cx + (rand() - 0.5) * 0.8,
          z: cz + (rand() - 0.5) * 0.8,
          w,
          d: type === 1 ? w : 2.2 + rand() * 1.4,
          h,
          type,
          glass: rand() < 0.85 ? 1 : 0,
          tint: GLASS[Math.floor(rand() * GLASS.length)],
          rot: rand() < 0.8 ? 0 : Math.PI / 4,
          score: 2 + core + rand(),
        });
        continue;
      }
      for (let k = 0; k < 4; k++) {
        const x = cx + (k & 1 ? 1.2 : -1.2);
        const z = cz + (k & 2 ? 1.2 : -1.2);
        const r = Math.hypot(x, z);
        if (r < 12 || r > R) continue;
        if (waterD(x, z) < 1.8) continue;
        if (Math.abs(x) < 1.4 && z > 0) continue; // the avenue
        const north = z < creekZ(x) ? 1 : 0; // old quarter across the creek
        const density = Math.max(0, 1.15 - r / 85) + 0.35 * core;
        if (rand() > density) continue;
        const mid = rand() < 0.1 + 0.25 * core && !north;
        const h = mid ? 2.5 + rand() * 4.5 : 0.35 + Math.pow(rand(), 2) * (north ? 1.0 : 2.2);
        const w = 1.1 + rand() * 1.0;
        const d = 1.1 + rand() * 1.0;
        const glass = mid ? (rand() < 0.6 ? 1 : 0) : rand() < 0.08 ? 1 : 0;
        const roll = rand();
        const type = (mid ? (roll < 0.25 ? 1 : roll < 0.55 ? 2 : 0) : roll < 0.05 ? 1 : 0) as 0 | 1 | 2;
        lots.push({
          x: x + (rand() - 0.5) * 0.3,
          z: z + (rand() - 0.5) * 0.3,
          w,
          d: type === 1 ? w : d,
          h,
          type,
          glass,
          tint: glass ? GLASS[Math.floor(rand() * GLASS.length)] : STONE[Math.floor(rand() * STONE.length)],
          rot: rand() < 0.9 ? 0 : (rand() - 0.5) * 0.3,
          score: (mid ? 1 : 0) + 1.2 * (1 - r / R) + rand() * 0.6,
        });
      }
    }
  }
  // the budget keeps the near and the tall buildings first; the far edge thins out
  lots.sort((a, b) => b.score - a.score);
  return lots.slice(0, count);
}

/** The whole context city baked into one static mesh (one draw call): each lot's box / cylinder / stepped block is
    transformed into world space once, with its tint, glass flag and a per-building seed as vertex attributes. */
function City({ uniforms, count, shadows }: { uniforms: SharedUniforms; count: number; shadows: boolean }) {
  const res = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1).translate(0, 0.5, 0);
    const parts = [
      new THREE.BoxGeometry(1, 0.62, 1).translate(0, 0.31, 0),
      new THREE.BoxGeometry(0.76, 0.24, 0.76).translate(0, 0.74, 0),
      new THREE.BoxGeometry(0.52, 0.14, 0.52).translate(0, 0.93, 0),
    ];
    const stepped = mergeGeometries(parts)!;
    const protos = [box, cyl, stepped];

    const lots = planCity(count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const pieces: THREE.BufferGeometry[] = [];
    for (const l of lots) {
      const g = protos[l.type].clone();
      q.setFromAxisAngle(up, l.rot);
      g.applyMatrix4(m.compose(p.set(l.x, 0, l.z), q, s.set(l.w, l.h, l.d)));
      const n = g.getAttribute("position").count;
      const col = new Float32Array(n * 3);
      const kind = new Float32Array(n).fill(l.glass);
      const seed = new Float32Array(n).fill(((Math.sin(l.x * 12.9898 + l.z * 78.233) * 43758.5453) % 1 + 1) % 1);
      for (let i = 0; i < n; i++) l.tint.toArray(col, i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
      g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      g.deleteAttribute("uv");
      pieces.push(g);
    }
    const geo = mergeGeometries(pieces)!;
    geo.computeBoundingSphere();
    pieces.forEach((g) => g.dispose());
    parts.forEach((g) => g.dispose());
    protos.forEach((g) => g.dispose());
    return { geo, mat: createCityMaterial(uniforms) };
  }, [uniforms, count]);

  useLayoutEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res]
  );

  return <mesh geometry={res.geo} material={res.mat} receiveShadow={shadows} frustumCulled={false} />;
}
