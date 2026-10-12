"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { explorer } from "@/lib/store";
import { FLOOR_H, floorBaseY, floorRotationDeg, residencesOn } from "@/lib/tower";

const DEG = Math.PI / 180;
/* Hero framing: the whole tower, crown and spire against the low western sun, from the east-south-east.
   Scrolling the explorer column (desktop) closes in on the selected level. */
const HERO_THETA = 1.45;
const WIDE_Y = 15.5;
const WIDE_PHI = 1.49;
const CLOSE_PHI = 1.3;
const CLOSE_R = 34;

function restTargetY(floor: number) {
  return floorBaseY(floor) + FLOOR_H / 2;
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
  targetY = 9;
  goalY = WIDE_Y;
  theta = HERO_THETA - 0.85;
  goalTheta = HERO_THETA;
  radius = 120;
  goalRadius = 72;
  phi = 1.36;
  goalPhi = WIDE_PHI;
  orbiting = true;
  moving = true;
  lambda = 1.2;
  revealed = false;
  reduced = false;
  zoom = 0;
  wideR = 72;
  private sph = new THREE.Spherical();
  private v = new THREE.Vector3();
  private lastKey = "";

  constructor(reduced: boolean) {
    const { floor, unit } = explorer.get();
    this.lastKey = `${floor}:${unit}`;
    this.reduced = reduced;
    this.goalY = this.frameY(floor);
    if (reduced) this.snap();
  }

  private frameY(floor: number) {
    const k = 0.2 + 0.8 * this.zoom;
    return WIDE_Y + (restTargetY(floor) - WIDE_Y) * k;
  }

  private frameR() {
    return this.wideR + (CLOSE_R - this.wideR) * this.zoom;
  }

  private snap() {
    this.targetY = this.goalY;
    this.theta = this.goalTheta;
    this.phi = this.goalPhi;
    this.radius = this.goalRadius;
  }

  /** pick up wherever the visitor left the camera */
  private pickUp(camera: THREE.Camera, controls: OrbitControlsImpl) {
    this.v.copy(camera.position).sub(controls.target);
    this.sph.setFromVector3(this.v);
    this.theta = this.sph.theta;
    this.phi = this.sph.phi;
    this.radius = this.sph.radius;
    this.targetY = controls.target.y;
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
  }

  setPortrait(portrait: boolean) {
    const goal = portrait ? 78 : 72;
    if (goal === this.wideR) return false;
    this.wideR = goal;
    this.goalRadius = this.frameR();
    if (this.reduced) this.radius = this.goalRadius;
    this.orbiting = true;
    this.moving = true;
    return true;
  }

  /** 0 = establishing shot, 1 = close on the selected level. */
  setZoom(z: number, camera: THREE.Camera, controls: OrbitControlsImpl) {
    if (Math.abs(z - this.zoom) < 0.004) return false;
    this.zoom = z;
    if (this.revealed) this.pickUp(camera, controls);
    this.goalTheta = this.revealed ? this.theta : this.goalTheta;
    this.goalY = this.frameY(explorer.get().floor);
    this.goalRadius = this.frameR();
    this.goalPhi = WIDE_PHI + (CLOSE_PHI - WIDE_PHI) * z;
    this.lambda = 3;
    this.orbiting = true;
    this.moving = true;
    if (this.reduced) this.snap();
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

    this.pickUp(camera, controls);
    this.goalY = this.frameY(floor);
    const th = unitTheta(floor, unit);
    this.goalTheta = th === null ? this.theta : shortest(this.theta, th);
    this.goalPhi = th === null ? this.phi : Math.min(Math.max(this.phi, 1.05), 1.45);
    this.goalRadius = this.frameR();
    this.lambda = 4;
    this.orbiting = true;
    this.moving = true;
    if (this.reduced) {
      // cut, don't sweep
      this.snap();
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

  // Scroll story (desktop, full motion): while the explorer column scrolls past the sticky stage,
  // the camera closes in from the establishing shot to the selected level.
  useEffect(() => {
    if (reduced) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const hero = document.getElementById("explore");
    if (!hero) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const c = controlsRef.current;
      if (!c) return;
      let z = 0;
      if (wide.matches) {
        const r = hero.getBoundingClientRect();
        const span = Math.max(400, r.height - window.innerHeight);
        const p = Math.min(1, Math.max(0, -r.top / span));
        z = p * p * (3 - 2 * p);
      }
      const { camera, invalidate } = get();
      if (rig.setZoom(Math.round(z * 100) / 100, camera, c)) invalidate();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    wide.addEventListener("change", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      wide.removeEventListener("change", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rig, get, reduced]);

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
      maxPolarAngle={1.52}
    />
  );
}
