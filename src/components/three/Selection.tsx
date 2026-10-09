"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { explorer } from "@/lib/store";
import { GLASS_H, floorBaseY, floorHalfSize, floorRotationDeg, residencesOn } from "@/lib/tower";
import { extrudeY, plateOutline, sectorShape } from "./geometry";
import type { SharedUniforms } from "./materials";

const DEG = Math.PI / 180;

interface SelectionTargets {
  uniforms: SharedUniforms;
  ring: React.RefObject<THREE.Group | null>;
  unitGroup: React.RefObject<THREE.Group | null>;
  unitMesh: React.RefObject<THREE.Mesh | null>;
  invalidate: () => void;
}

/** Follows the store: moves the ring, rebuilds the residence volume, updates the facade uniforms. */
function bindSelection(t: SelectionTargets) {
  let lastKey = "";
  let geom: THREE.BufferGeometry | null = null;

  const apply = () => {
    const { floor, unit } = explorer.get();
    const key = `${floor}:${unit}`;
    if (key === lastKey) return;
    lastKey = key;

    const size = floorHalfSize(floor);
    const rot = floorRotationDeg(floor) * DEG;
    t.uniforms.uSel.value = floor - 1;

    const ring = t.ring.current;
    if (ring) {
      ring.position.set(0, floorBaseY(floor) + GLASS_H + 0.03, 0);
      ring.rotation.y = rot;
      ring.scale.set(size, 1, size);
    }

    const r = residencesOn(floor)[unit];
    const group = t.unitGroup.current;
    const mesh = t.unitMesh.current;
    if (r && group && mesh) {
      t.uniforms.uUnitOn.value = 1;
      t.uniforms.uUnitC.value = r.angle;
      t.uniforms.uUnitHalf.value = r.half;
      geom?.dispose();
      geom = extrudeY(sectorShape(r.angle, r.half, 1.03), GLASS_H * 1.02);
      mesh.geometry = geom;
      group.visible = true;
      group.position.set(0, floorBaseY(floor) - GLASS_H * 0.01, 0);
      group.rotation.y = rot;
      group.scale.set(size, 1, size);
    } else {
      t.uniforms.uUnitOn.value = 0;
      if (group) group.visible = false;
    }
    t.invalidate();
  };

  apply();
  const unsub = explorer.subscribe(apply);
  return () => {
    unsub();
    geom?.dispose();
  };
}

/** Gold ring around the chosen level and a teal volume over the chosen residence. */
export function Selection({ uniforms }: { uniforms: SharedUniforms }) {
  const invalidate = useThree((s) => s.invalidate);
  const ringRef = useRef<THREE.Group>(null);
  const unitRef = useRef<THREE.Group>(null);
  const unitMesh = useRef<THREE.Mesh>(null);

  const ringPoints = useMemo(() => {
    const pts = plateOutline(1.07, 128).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    pts.push(pts[0].clone());
    return pts;
  }, []);

  const unitMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#5cc2be",
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );

  useEffect(
    () => bindSelection({ uniforms, ring: ringRef, unitGroup: unitRef, unitMesh, invalidate }),
    [uniforms, invalidate]
  );

  useEffect(() => () => unitMat.dispose(), [unitMat]);

  return (
    <>
      <group ref={ringRef}>
        <Line points={ringPoints} color="#f1bd6b" lineWidth={2} transparent opacity={0.95} toneMapped={false} />
      </group>
      <group ref={unitRef}>
        <mesh ref={unitMesh} material={unitMat} renderOrder={2} />
      </group>
    </>
  );
}
