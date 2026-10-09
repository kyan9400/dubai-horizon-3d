import * as THREE from "three";

/* The floor plate is a superellipse (|x|^n + |y|^n = 1): softer than a square, crisper than a circle.
   Shape space: x = east, y = north. extrudeY() turns a shape into a solid that rises along +Y, so shape y → world -Z. */

const N = 4.2;
const P = 2 / N;

function superPoint(t: number, size: number, out = new THREE.Vector2()) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return out.set(Math.sign(c) * Math.pow(Math.abs(c), P) * size, Math.sign(s) * Math.pow(Math.abs(s), P) * size);
}

export function plateOutline(size = 1, segments = 128): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < segments; i++) pts.push(superPoint((i / segments) * Math.PI * 2, size));
  return pts;
}

export function plateShape(size = 1, segments = 128) {
  return new THREE.Shape(plateOutline(size, segments));
}

/** A slice of the plate, centred on `center` (radians) with half-width `half`. Bounds are multiples of 45°,
    where the superellipse's parameter angle equals its polar angle, so the slice is exact. */
export function sectorShape(center: number, half: number, size = 1, steps = 28) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const p = superPoint(center - half + (i / steps) * half * 2, size);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  return shape;
}

export function extrudeY(shape: THREE.Shape, depth: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Points on the outline at evenly spaced parameter angles, with outward normals (for fins). */
export function perimeterSamples(count: number, size = 1) {
  const out: { x: number; y: number; nx: number; ny: number }[] = [];
  const a = new THREE.Vector2();
  const b = new THREE.Vector2();
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * Math.PI * 2;
    superPoint(t, size, a);
    superPoint(t + 0.001, size, b);
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    out.push({ x: a.x, y: a.y, nx: ty / len, ny: -tx / len });
  }
  return out;
}

/** Deterministic random numbers, so the city is the same on every visit. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
