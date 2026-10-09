"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  FLOORS,
  FLOOR_H,
  GLASS_H,
  PODIUM_H,
  floorBaseY,
  floorHalfSize,
  floorRotationDeg,
} from "@/lib/tower";
import { extrudeY, perimeterSamples, plateShape } from "./geometry";
import { createGlassMaterial, createSlabMaterial, type SharedUniforms } from "./materials";

const DEG = Math.PI / 180;
const SLAB_H = FLOOR_H - GLASS_H;
const FINS_PER_FLOOR = 40;

interface Props {
  uniforms: SharedUniforms;
  fins: boolean;
  shadows: boolean;
  crownRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}

/** 72 twisted floors in two instanced draw calls (+ one for the fins). */
export function Tower({ uniforms, fins, shadows, crownRef }: Props) {
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const slabRef = useRef<THREE.InstancedMesh>(null);
  const finRef = useRef<THREE.InstancedMesh>(null);
  const crownFinRef = useRef<THREE.InstancedMesh>(null);

  const res = useMemo(() => {
    const shape = plateShape(1, 128);
    const glass = extrudeY(shape, GLASS_H);
    const slab = extrudeY(plateShape(1.035, 128), SLAB_H);
    const fin = new THREE.BoxGeometry(0.022, GLASS_H, 0.085);
    fin.translate(0, GLASS_H / 2, 0.03);
    const crownFin = new THREE.BoxGeometry(0.03, 1, 0.12);
    crownFin.translate(0, 0.5, 0);
    return {
      podium: extrudeY(plateShape(2.75, 96), PODIUM_H),
      garden: extrudeY(plateShape(2.6, 96), 0.025),
      lantern: extrudeY(plateShape(1, 96), 0.55),
      glass,
      slab,
      fin,
      crownFin,
      glassMat: createGlassMaterial(uniforms),
      slabMat: createSlabMaterial(uniforms),
      finMat: new THREE.MeshStandardMaterial({ color: "#cdb68a", metalness: 0.85, roughness: 0.3 }),
    };
  }, [uniforms]);

  const topY = floorBaseY(FLOORS) + FLOOR_H;
  const topRot = floorRotationDeg(FLOORS) * DEG;
  const topSize = floorHalfSize(FLOORS);
  const crownCount = 36;

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const samples = perimeterSamples(FINS_PER_FLOOR, 1);
    const crownSamples = perimeterSamples(crownCount, 1);

    for (let i = 0; i < FLOORS; i++) {
      const floor = i + 1;
      const size = floorHalfSize(floor);
      q.setFromAxisAngle(up, floorRotationDeg(floor) * DEG);
      p.set(0, floorBaseY(floor), 0);
      s.set(size, 1, size);
      m.compose(p, q, s);
      glassRef.current?.setMatrixAt(i, m);
      p.y += GLASS_H;
      slabRef.current?.setMatrixAt(i, m.compose(p, q, s.set(size, 1, size)));

      if (finRef.current) {
        const rot = floorRotationDeg(floor) * DEG;
        for (let k = 0; k < FINS_PER_FLOOR; k++) {
          const sm = samples[k];
          // shape (x, y) → world (x, -y), then rotate by the plate twist
          const lx = sm.x * size;
          const lz = -sm.y * size;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          p.set(lx * cos + lz * sin, floorBaseY(floor), -lx * sin + lz * cos);
          const nAng = Math.atan2(sm.nx, -sm.ny) + rot; // fin depth (local +z) points outward
          q.setFromAxisAngle(up, nAng);
          finRef.current.setMatrixAt(i * FINS_PER_FLOOR + k, m.compose(p, q, s.set(1, 1, 1)));
        }
      }
    }

    // Crown: blades that rise toward the south-west corner, a lantern for the observatory
    if (crownFinRef.current) {
      const cos = Math.cos(topRot);
      const sin = Math.sin(topRot);
      for (let k = 0; k < crownCount; k++) {
        const sm = crownSamples[k];
        const lx = sm.x * topSize * 0.98;
        const lz = -sm.y * topSize * 0.98;
        p.set(lx * cos + lz * sin, topY, -lx * sin + lz * cos);
        const a = Math.atan2(sm.y, sm.x);
        const h = 0.9 + 2.3 * Math.pow(0.5 + 0.5 * Math.cos(a - 3.6), 2.2);
        q.setFromAxisAngle(up, Math.atan2(sm.nx, -sm.ny) + topRot);
        crownFinRef.current.setMatrixAt(k, m.compose(p, q, s.set(1, h, 1)));
      }
      crownFinRef.current.instanceMatrix.needsUpdate = true;
      crownFinRef.current.computeBoundingSphere();
    }

    for (const mesh of [glassRef.current, slabRef.current, finRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [res, topRot, topSize, topY]);

  useLayoutEffect(
    () => () => {
      res.podium.dispose();
      res.garden.dispose();
      res.lantern.dispose();
      res.glass.dispose();
      res.slab.dispose();
      res.fin.dispose();
      res.crownFin.dispose();
      res.glassMat.dispose();
      res.slabMat.dispose();
      res.finMat.dispose();
    },
    [res]
  );

  return (
    <group>
      {/* podium + garden roof */}
      <mesh position={[0, 0, 0]} castShadow={shadows} receiveShadow={shadows}>
        <primitive object={res.podium} attach="geometry" />
        <meshStandardMaterial color="#cbbda3" roughness={0.75} />
      </mesh>
      <mesh position={[0, PODIUM_H, 0]} receiveShadow={shadows}>
        <primitive object={res.garden} attach="geometry" />
        <meshStandardMaterial color="#6d7958" roughness={0.95} />
      </mesh>

      <instancedMesh
        ref={glassRef}
        args={[res.glass, res.glassMat, FLOORS]}
        castShadow={shadows}
        receiveShadow={shadows}
        frustumCulled={false}
      />
      <instancedMesh
        ref={slabRef}
        args={[res.slab, res.slabMat, FLOORS]}
        castShadow={shadows}
        receiveShadow={shadows}
        frustumCulled={false}
      />
      {fins && (
        <instancedMesh ref={finRef} args={[res.fin, res.finMat, FLOORS * FINS_PER_FLOOR]} castShadow={shadows} frustumCulled={false} />
      )}

      {/* crown blades, observatory lantern and spire */}
      <instancedMesh ref={crownFinRef} args={[res.crownFin, undefined, crownCount]} frustumCulled={false}>
        <meshStandardMaterial ref={crownRef} color="#d2bb8c" metalness={0.8} roughness={0.32} emissive="#f3b561" emissiveIntensity={0} />
      </instancedMesh>
      <mesh position={[0, topY, 0]} rotation={[0, topRot, 0]} scale={[topSize * 0.9, 1, topSize * 0.9]}>
        <primitive object={res.lantern} attach="geometry" />
        <meshStandardMaterial color="#20262f" metalness={0.9} roughness={0.15} emissive="#ffcf8a" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, topY + 2.6, 0]}>
        <cylinderGeometry args={[0.018, 0.05, 2.4, 8]} />
        <meshStandardMaterial color="#cdb68a" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, topY + 3.85, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color="#ff4a3a" toneMapped={false} />
      </mesh>
    </group>
  );
}
