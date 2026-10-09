"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { explorer } from "@/lib/store";
import { FLOOR_H, floorBaseY, floorRotationDeg, residencesOn } from "@/lib/tower";

const DEG = Math.PI / 180;
const TOWER_MID = 15;

function restTargetY(floor: number) {
  return 0.62 * (floorBaseY(floor) + FLOOR_H / 2) + 0.38 * TOWER_MID;
}

/** Spherical theta that looks at the selected residence's facade (three-quarter view), or null. */
function unitTheta(floor: number, unit: number): number | null {
  const r = residencesOn(floor)[unit];
  if (!r) return null;
  const world = r.angle + floorRotationDeg(floor) * DEG; // CCW from east
  // facade direction in world (x, z) = (cos, -sin); Spherical theta = atan2(x, z)
  return Math.atan2(Math.cos(world), -Math.sin(world)) - 0.32;
}

function shortest(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

/**
 * Camera state machine, kept outside React: level changes glide the orbit target, residence changes swing the camera
 * to that facade, dragging cancels the swing. frame() returns true while another frame is needed (frameloop="demand").
 */
class Rig {
  targetY = 6;
  goalY = restTargetY(explorer.get().floor);
  theta = 0;
  goalTheta = 0;
  radius = 78;
  goalRadius = 37;
  phi = 1.42;
  goalPhi = 1.2;
  orbiting = true;
  moving = true;
  lambda = 1.5;
  revealed = false;
  reduced = false;
  private sph = new THREE.Spherical();
  private v = new THREE.Vector3();
  private lastKey = "";

  constructor(reduced: boolean) {
    const { floor, unit } = explorer.get();
    this.lastKey = `${floor}:${unit}`;
    this.goalTheta = unitTheta(floor, unit) ?? -0.75;
    this.theta = this.goalTheta - 1.1;
    this.reduced = reduced;
    if (reduced) this.snap();
  }

  private snap() {
    this.targetY = this.goalY;
    this.theta = this.goalTheta;
    this.phi = this.goalPhi;
    this.radius = this.goalRadius;
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
  }

  setPortrait(portrait: boolean) {
    const goal = portrait ? 41 : 37;
    if (goal === this.goalRadius) return false;
    this.goalRadius = goal;
    if (this.reduced) this.radius = goal;
    this.orbiting = true;
    this.moving = true;
    return true;
  }

  reveal() {
    this.revealed = true;
    this.moving = true;
  }

  dragStart() {
    this.orbiting = false;
  }

  /** Store changed: returns true if the camera has somewhere new to go. */
  onSelection(camera: THREE.Camera, controls: OrbitControlsImpl): boolean {
    const { floor, unit } = explorer.get();
    const key = `${floor}:${unit}`;
    if (key === this.lastKey) return false;
    this.lastKey = key;

    // pick up wherever the visitor left the camera
    this.v.copy(camera.position).sub(controls.target);
    this.sph.setFromVector3(this.v);
    this.theta = this.sph.theta;
    this.phi = this.sph.phi;
    this.radius = this.sph.radius;
    this.targetY = controls.target.y;

    this.goalY = restTargetY(floor);
    const th = unitTheta(floor, unit);
    this.goalTheta = th === null ? this.theta : shortest(this.theta, th);
    this.goalPhi = th === null ? this.phi : Math.min(Math.max(this.phi, 1.05), 1.35);
    this.goalRadius = this.radius;
    this.lambda = 4;
    this.orbiting = true;
    this.moving = true;
    if (this.reduced) {
      // cut, don't sweep
      this.targetY = this.goalY;
      this.theta = this.goalTheta;
      this.phi = this.goalPhi;
    }
    return true;
  }

  frame(camera: THREE.Camera, controls: OrbitControlsImpl, delta: number): boolean {
    if (!this.revealed) {
      // hold the opening pose behind the poster
      controls.target.set(0, this.targetY, 0);
      this.sph.set(this.radius, this.phi, this.theta);
      camera.position.setFromSpherical(this.sph).add(controls.target);
      camera.lookAt(controls.target);
      return false;
    }
    if (!this.moving) return false;

    const k = 1 - Math.exp(-this.lambda * Math.min(delta, 0.05));
    const prevY = controls.target.y;
    this.targetY += (this.goalY - this.targetY) * k;
    controls.target.set(0, this.targetY, 0);

    if (this.orbiting) {
      this.theta += (this.goalTheta - this.theta) * k;
      this.phi += (this.goalPhi - this.phi) * k;
      this.radius += (this.goalRadius - this.radius) * k;
      this.sph.set(this.radius, this.phi, this.theta);
      camera.position.setFromSpherical(this.sph).add(controls.target);
    } else {
      camera.position.y += this.targetY - prevY;
    }
    camera.lookAt(controls.target);

    const done =
      Math.abs(this.goalY - this.targetY) < 0.002 &&
      (!this.orbiting ||
        (Math.abs(this.goalTheta - this.theta) < 0.0008 &&
          Math.abs(this.goalPhi - this.phi) < 0.0008 &&
          Math.abs(this.goalRadius - this.radius) < 0.005));
    if (done) this.moving = false;
    return !done;
  }
}

interface Props {
  reduced: boolean;
  /** false while the poster still covers the canvas: the intro glide waits for it */
  revealed: boolean;
}

export function CameraRig({ reduced, revealed }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const get = useThree((s) => s.get);
  const portrait = useThree((s) => s.size.width / s.size.height < 0.9);
  const [rig] = useState(() => new Rig(reduced));

  useEffect(() => {
    rig.setReduced(reduced);
  }, [rig, reduced]);

  useEffect(() => {
    if (rig.setPortrait(portrait)) get().invalidate();
  }, [rig, portrait, get]);

  useEffect(() => {
    if (!revealed) return;
    rig.reveal();
    get().invalidate();
  }, [rig, revealed, get]);

  useEffect(
    () =>
      explorer.subscribe(() => {
        const c = controlsRef.current;
        const { camera, invalidate } = get();
        if (c && rig.onSelection(camera, c)) invalidate();
      }),
    [rig, get]
  );

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const onStart = () => rig.dragStart();
    c.addEventListener("start", onStart);
    // On touch screens vertical swipes keep scrolling the page; horizontal swipes turn the tower.
    if (window.matchMedia("(pointer: coarse)").matches) c.domElement?.style.setProperty("touch-action", "pan-y");
    return () => c.removeEventListener("start", onStart);
  }, [rig]);

  useFrame((state, delta) => {
    const c = controlsRef.current;
    if (c && rig.frame(state.camera, c, delta)) state.invalidate();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.55}
      minPolarAngle={0.35}
      maxPolarAngle={1.5}
    />
  );
}
