import * as THREE from "three";
import { GLASS_H } from "@/lib/tower";
import { SAT_SIZE, type SatUniforms } from "./satellite";

/* Shared uniforms: written by the scene controllers when the store changes, read by every patched material.
   The sky terms live here too, so the water and the sky dome compute exactly the same colours. */
export function createUniforms() {
  return {
    uNight: { value: 0 },
    uDay: { value: 1 },
    /** 0 by day → 1 at night; already ~0.35 at golden hour, so the first windows light up at dusk */
    uLights: { value: 0 },
    uSel: { value: 47 },
    uUnitC: { value: 0 },
    uUnitHalf: { value: 0.78 },
    uUnitOn: { value: 1 },
    uGlassH: { value: GLASS_H },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uFogC: { value: new THREE.Color() },
    uGolden: { value: 0 },
    uSunVis: { value: 1 },
  };
}
export type SharedUniforms = ReturnType<typeof createUniforms>;

export const HEAD = /* glsl */ `
uniform float uNight;
uniform float uDay;
uniform float uLights;
uniform float uSel;
uniform float uUnitC;
uniform float uUnitHalf;
uniform float uUnitOn;
uniform float uGlassH;
float hzHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

/** Sky radiance for a direction: gradient, haze band, sun glow and disc, golden cirrus, optional stars. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFogC;
uniform float uGolden;
uniform float uSunVis;
float hzN2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hzHash(i);
  float b = hzHash(i + vec2(1.0, 0.0));
  float c = hzHash(i + vec2(0.0, 1.0));
  float d = hzHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float hzFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * hzN2(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
vec3 hzSky(vec3 d, float stars) {
  float h = d.y;
  float t = 1.0 - exp(-max(h, 0.0) * 7.0);
  float s = max(dot(d, uSunDir), 0.0);
  // away from the sun the low sky turns rose and blue (the shadow side of the sky)
  vec2 hzSd = normalize(uSunDir.xz + vec2(1e-4));
  float away = 0.5 - 0.5 * dot(normalize(d.xz + vec2(1e-4)), hzSd);
  vec3 hor = mix(uHorizon, mix(uZenith * 1.6, vec3(0.62, 0.36, 0.42), 0.55), away * uGolden * 0.75);
  vec3 col = mix(hor, uZenith, t);
  vec3 sunCol = mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 0.48, 0.18), uGolden);
  col += sunCol * (pow(s, 8.0) * 0.3 * uGolden + pow(s, 48.0) * 0.5 + pow(s, 500.0) * 1.5) * uSunVis;
  // haze band on the horizon, melting into the fog colour below it
  col = mix(col, uFogC, exp(-max(h, 0.0) * 22.0) * 0.45 * (1.0 - away * uGolden * 0.6));
  col = mix(col, uFogC, smoothstep(0.0, -0.04, h));
  // high cirrus, lit warm from below at golden hour
  float c = 0.0;
  if (h > 0.0) {
    // thin streaks stretched along the horizon
    vec2 p = d.xz / (h + 0.06);
    vec2 q = vec2(dot(p, vec2(0.8, 0.6)) * 0.35, dot(p, vec2(-0.6, 0.8)) * 5.0);
    float n = hzFbm(q + vec2(3.0, 7.0));
    c = smoothstep(0.55, 0.78, n) * smoothstep(0.01, 0.06, h) * (1.0 - smoothstep(0.12, 0.3, h)) * 0.4;
    vec3 lit = mix(uHorizon * 1.2 + vec3(0.05), sunCol * (1.4 + 2.0 * pow(s, 4.0)), clamp(uGolden * 0.7 + pow(s, 3.0), 0.0, 1.0));
    vec3 cc = mix(lit, uZenith * 0.7 + vec3(0.015, 0.015, 0.02), uNight);
    col = mix(col, cc, c * 0.8);
  }
  col += sunCol * pow(s, 1800.0) * 40.0 * uSunVis * (1.0 - c);
  if (stars > 0.0) {
    vec3 sp = d * 220.0;
    vec3 cell = floor(sp);
    vec3 f = fract(sp) - 0.5;
    float r = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    float st = step(0.9965, r) * smoothstep(0.32, 0.0, length(f)) * (0.5 + 0.5 * fract(r * 91.7));
    col += vec3(0.9, 0.93, 1.0) * st * uNight * smoothstep(0.02, 0.2, h) * 1.4 * (1.0 - c);
  }
  // city glow on the horizon at night
  col += vec3(0.6, 0.32, 0.14) * uNight * 0.3 * exp(-abs(h) * 12.0);
  return col;
}
`;

/** Tower glass: facade pattern, lit windows, sky gardens, selected level and residence — all in the shader. */
export function createGlassMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.9, roughness: 0.06, envMapIntensity: 1.35 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzLocal;\nvarying float vHzInst;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHzLocal = position;\nvHzInst = float(gl_InstanceID);"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzLocal;\nvarying float vHzInst;" + HEAD)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float hzAng = atan(-vHzLocal.z, vHzLocal.x);
        float hzCell = (hzAng / 6.2831853 + 0.5) * 56.0;
        float hzCf = fract(hzCell);
        float hzCol = floor(hzCell);
        float hzY = clamp(vHzLocal.y / uGlassH, 0.0, 1.0);
        float hzMull = smoothstep(0.0, 0.035, hzCf) * (1.0 - smoothstep(0.965, 1.0, hzCf));
        float hzBand = 1.0 - smoothstep(0.92, 0.95, hzY);
        float hzMask = hzMull * hzBand;
        // sky gardens (levels 22, 46) and the crown pool (71): recessed, warmly lit
        float hzGarden = step(abs(vHzInst - 21.0), 0.5) + step(abs(vHzInst - 45.0), 0.5) + step(abs(vHzInst - 70.0), 0.5);
        float hzSel = 1.0 - step(0.5, abs(vHzInst - uSel));
        float hzD = abs(atan(sin(hzAng - uUnitC), cos(hzAng - uUnitC)));
        float hzUnit = hzSel * uUnitOn * (1.0 - step(uUnitHalf, hzD));
        float hzR = hzHash(vec2(vHzInst, hzCol));
        float hzR2 = hzHash(vec2(hzCol * 0.37, vHzInst * 1.7));
        float hzLitK = smoothstep(0.0, 0.45, uLights);
        float hzSect = floor(hzCell / 7.0);
        float hzRs = hzHash(vec2(vHzInst * 0.71, hzSect + 3.0));
        float hzLit = step(hzRs, 0.3 + 0.5 * uLights) * hzLitK * (0.55 + 0.45 * step(hzR, 0.75));
        vec3 hzWarm = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.84, 0.62), hzR2);
        // height gradient: a touch warmer and lighter toward the crown
        float hzH = vHzInst / 71.0;
        vec3 hzGlass = mix(vec3(0.44, 0.52, 0.58), vec3(0.62, 0.6, 0.56), hzH * 0.6);
        hzGlass = mix(hzGlass, vec3(0.2, 0.24, 0.3), uNight);
        hzGlass *= 0.88 + 0.24 * hzR2;
        vec3 hzFrame = vec3(0.5, 0.42, 0.31);
        diffuseColor.rgb = mix(hzFrame, hzGlass, hzMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.7, 0.34), hzSel * (1.0 - hzMask) * 0.85);`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.6, 0.96, hzMask);
        roughnessFactor = mix(0.32, 0.035 + 0.05 * hzR2, hzMask);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += hzWarm * hzLit * hzMask * (0.22 + 0.3 * hzRs + 0.1 * uNight) * (0.75 + 0.25 * hzY) * (1.0 - hzUnit) * (1.0 - hzGarden);
        totalEmissiveRadiance += vec3(1.0, 0.68, 0.36) * hzGarden * hzMask * (0.35 + 1.4 * hzLitK);
        totalEmissiveRadiance += vec3(0.95, 0.66, 0.28) * hzSel * (0.12 + 0.75 * uNight) * (1.0 - hzMask * 0.55);
        totalEmissiveRadiance += vec3(0.3, 0.86, 0.82) * hzUnit * hzMask * (0.5 + 0.7 * uNight);`
      );
  };
  m.customProgramCacheKey = () => "hz-glass-2";
  return m;
}

/** Slab edges between levels: thin bronze lines; the selected level's slab glows softly gold. */
export function createSlabMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#8a7457", roughness: 0.38, metalness: 0.75 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vHzInst;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHzInst = float(gl_InstanceID);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHzInst;" + HEAD)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float hzSel = 1.0 - step(0.5, abs(vHzInst - uSel));
        totalEmissiveRadiance += vec3(1.0, 0.7, 0.32) * hzSel * (0.35 + 1.1 * uNight);
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.45) * uLights * 0.08;`
      );
  };
  m.customProgramCacheKey = () => "hz-slab-2";
  return m;
}

/**
 * Context city: one merged world-space mesh, one material. Per vertex: tint (vertex colour), seed and `aKind`
 * (0 = stone with punched windows, 1 = curtain-wall glass). Facade grid, roofs and night windows from world position.
 */
export function createCityMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.85, metalness: 0.05, envMapIntensity: 1.5 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aKind;\nattribute float aSeed;\nvarying vec3 vHzWorld;\nvarying vec3 vHzNW;\nvarying float vHzK;\nvarying float vHzSeed;"
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vHzWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vHzNW = normal;
        vHzK = aKind;
        vHzSeed = aSeed;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHzWorld;\nvarying vec3 vHzNW;\nvarying float vHzK;\nvarying float vHzSeed;" + HEAD
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec3 hzN = normalize(vHzNW);
        float hzSide = 1.0 - step(0.6, abs(hzN.y));
        vec2 hzT = normalize(vec2(-hzN.z, hzN.x) + vec2(1e-4));
        float hzU = dot(vHzWorld.xz, hzT);
        float hzFloorH = mix(0.32, 0.28, vHzK);
        vec2 hzC = vec2(hzU / mix(0.24, 0.18, vHzK), vHzWorld.y / hzFloorH);
        vec2 hzF = fract(hzC);
        vec2 hzId = floor(hzC);
        float hzWin = step(0.2, hzF.x) * step(hzF.x, 0.8) * step(0.24, hzF.y) * step(hzF.y, 0.8) * step(0.25, vHzWorld.y);
        float hzSpan = step(0.84, hzF.y);
        vec3 hzBase = diffuseColor.rgb;
        vec3 hzStone = hzBase * mix(1.0, 0.78, hzWin * hzSide);
        vec3 hzGl = hzBase * mix(1.0, 0.55, hzSpan * hzSide);
        diffuseColor.rgb = mix(hzStone, hzGl, vHzK);
        // roofs: plant and gravel, a little darker
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(hzBase * 0.72, vec3(0.32, 0.31, 0.3), vHzK), 1.0 - hzSide);
        diffuseColor.rgb *= 0.92 + 0.16 * vHzSeed;
        diffuseColor.rgb *= mix(1.0, 0.5, uNight);
        float hzGlassSide = vHzK * hzSide;`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.05, 0.88, hzGlassSide * (1.0 - hzSpan * 0.6));
        roughnessFactor = mix(mix(0.88, 0.3, hzWin * hzSide), 0.1, hzGlassSide);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        float hzOn = step(hzHash(hzId + vec2(vHzSeed * 91.0, vHzSeed * 17.0)), 0.05 + 0.33 * uLights * uLights);
        float hzWinL = mix(hzWin, (1.0 - hzSpan) * step(0.25, vHzWorld.y), vHzK);
        vec3 hzTint = mix(vec3(1.0, 0.6, 0.3), vec3(0.8, 0.88, 1.0), step(0.85, hzHash(hzId.yx + vHzSeed * 13.0)));
        totalEmissiveRadiance += hzTint * hzSide * hzWinL * hzOn * smoothstep(0.0, 0.5, uLights) * (0.2 + 0.12 * uNight) * (0.6 + 0.8 * hzHash(hzId * 1.3));`
      );
  };
  m.customProgramCacheKey = () => "hz-city-3";
  return m;
}

/* ---------------------------------------------------------------------------------------------
   Ground: one plane, one draw call. Land / Gulf / creek / lagoon from the same layout functions as the
   building placement (see layout.ts). Water reflects the analytic sky with ripples and a sun glitter path.
   --------------------------------------------------------------------------------------------- */
export const LAYOUT_GLSL = /* glsl */ `
float hzSeaEdge(float z) { return -62.0 + 9.0 * sin(z * 0.021 + 0.6) + 4.0 * sin(z * 0.057); }
float hzCreekZ(float x) { return -15.0 + 6.0 * sin(x * 0.045 + 1.0) + 3.0 * sin(x * 0.11); }
float hzCreekW(float x) { return (1.5 + 2.6 * smoothstep(0.0, -60.0, x)) * smoothstep(78.0, 58.0, x); }
/* signed distance-ish to water: < 0 means water */
float hzWaterD(vec2 p) {
  float sea = p.x - hzSeaEdge(p.y);
  float creek = abs(p.y - hzCreekZ(p.x)) - hzCreekW(p.x);
  float lagoon = length(p) - 8.0;
  return min(min(sea, creek), lagoon);
}
`;

/* Beyond the quay the ground is the real Dubai coast (NASA Landsat, see satellite.ts): its land colour replaces the
   procedural desert, its water mask takes over from the layout functions past ~100 units, and its built-up mask
   lights the real city grid after dusk. */
const SAT_GLSL = /* glsl */ `
uniform sampler2D uSat;
uniform sampler2D uSatMask;
uniform float uSatOn;
`;

export function createGroundMaterial(u: SharedUniforms, sat: SatUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, sat);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzW;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvHzW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzW;" + HEAD + SKY_GLSL + LAYOUT_GLSL + SAT_GLSL)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec2 hzP = vHzW.xz;
        float hzR = length(hzP);
        float hzWd = hzWaterD(hzP);
        float hzAa = max(fwidth(hzWd), 0.02);
        // the real coast: colour + masks, faded in past the procedural quarter around the tower
        vec2 hzSatUv = vec2(0.5 + hzP.x / ${SAT_SIZE.toFixed(1)}, 0.5 - hzP.y / ${SAT_SIZE.toFixed(1)});
        vec3 hzSatRaw = texture2D(uSat, hzSatUv).rgb;
        vec2 hzSatM = texture2D(uSatMask, hzSatUv).rg;
        vec3 hzSatLin = pow(hzSatRaw, vec3(2.2)) * vec3(1.04, 0.98, 0.92);
        float hzFar = uSatOn * smoothstep(84.0, 128.0, hzR + 18.0 * (hzFbm(hzP * 0.015 + 3.0) - 0.5) * 2.0);
        float hzWaterP = 1.0 - smoothstep(-hzAa, hzAa, hzWd);
        float hzWater = mix(hzWaterP, smoothstep(0.3, 0.7, hzSatM.r), hzFar);
        // a distance-like shore term for the far water (shallows, city shimmer)
        float hzWdM = mix(hzWd, (0.5 - hzSatM.r) * 8.0, hzFar);
        // desert: warm sand with long dune ripples
        float hzDn = hzFbm(hzP * 0.03);
        float hzDune = sin(hzP.x * 0.09 + hzP.y * 0.05 + hzDn * 6.0) * 0.5 + 0.5;
        vec3 hzSand = mix(vec3(0.7, 0.55, 0.37), vec3(0.8, 0.64, 0.44), hzDune * 0.5 + hzDn * 0.2);
        hzSand = mix(hzSand, hzSatLin, uSatOn);
        // city floor: pale concrete blocks, darker asphalt grid, wide boulevards every 4 blocks
        float hzUrbanR = 84.0 + 18.0 * (hzFbm(hzP * 0.02 + 7.0) - 0.5) * 2.0;
        float hzUrban = 1.0 - smoothstep(hzUrbanR - 8.0, hzUrbanR, hzR);
        vec2 hzG = abs(fract((hzP + 3.0) / 6.0) - 0.5) * 6.0; // distance to block centre lines
        float hzRoad = max(step(2.62, hzG.x), step(2.62, hzG.y));
        vec2 hzG2 = abs(fract((hzP + 3.0) / 24.0) - 0.5) * 24.0;
        float hzBlvd = max(step(11.45, hzG2.x), step(11.45, hzG2.y));
        float hzAve = step(abs(hzP.x), 0.6) * step(0.0, hzP.y);
        hzRoad = max(max(hzRoad, hzBlvd), hzAve);
        vec3 hzBlock = mix(vec3(0.36, 0.34, 0.31), vec3(0.5, 0.46, 0.4), hzN2(floor(hzP / 6.0) * 1.7));
        hzBlock = mix(hzBlock, vec3(0.2, 0.3, 0.18), step(0.86, hzN2(floor(hzP / 6.0) * 2.3 + 4.0))); // parks
        vec3 hzCity = mix(hzBlock, vec3(0.12, 0.12, 0.13), hzRoad);
        vec3 hzLand = mix(hzSand, hzCity, hzUrban);
        // beach along the Gulf and the creek
        float hzBeach = 1.0 - smoothstep(0.0, 1.6, hzWd);
        hzLand = mix(hzLand, vec3(0.86, 0.76, 0.6), hzBeach * (1.0 - step(hzR, 9.5)) * (1.0 - hzFar));
        hzLand = mix(hzLand, hzSatLin, hzFar);
        // moonlit, bluer land at night so the real city reads by its lights, not its daylight colour
        hzLand *= mix(vec3(1.0), vec3(0.6, 0.68, 0.92), uNight * uSatOn);
        // quay ring and the causeway to the podium
        float hzQuay = step(8.0, hzR) * step(hzR, 8.7);
        float hzCause = step(abs(hzP.x), 0.45) * step(2.6, hzP.y) * step(hzP.y, 8.7);
        hzLand = mix(hzLand, vec3(0.86, 0.8, 0.7), max(hzQuay, hzCause));
        diffuseColor.rgb = hzLand;
        float hzLampLine = max(step(2.9, hzG.x), step(2.9, hzG.y)) * 0.5 + max(step(11.85, hzG2.x), step(11.85, hzG2.y));
        float hzRoadLit = hzLampLine * hzUrban * (1.0 - hzWater);
        float hzSatLit = hzSatM.g * uSatOn * max(hzFar, 1.0 - hzUrban) * (1.0 - hzWater);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        // street lights: the grid glows amber after dusk
        float hzLampK = smoothstep(0.5, 1.0, uLights);
        totalEmissiveRadiance += vec3(1.0, 0.55, 0.22) * hzRoadLit * hzLampK * 0.9;
        totalEmissiveRadiance += vec3(1.0, 0.75, 0.45) * max(hzQuay, hzCause) * hzLampK * 0.5 * (1.0 - hzWater);
        // the real city's built-up areas glow sodium-orange, broken into blocks
        float hzGrain = 0.12 + 0.88 * smoothstep(0.5, 0.9, hzN2(hzP * 1.7)) * (0.5 + hzN2(hzP * 0.21 + 5.0));
        totalEmissiveRadiance += vec3(1.0, 0.56, 0.24) * hzSatLit * hzGrain * hzLampK * 0.42;`
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        if (hzWater > 0.0) {
          vec3 hzV = normalize(vHzW - cameraPosition);
          float hzDist = length(vHzW - cameraPosition);
          float hzAmp = 0.03 / (1.0 + hzDist * 0.012);
          // fade the ripples out where they would alias into a grid
          hzAmp *= 1.0 - smoothstep(0.15, 0.6, length(fwidth(hzP)));
          vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * hzP;
          vec2 hzRip = vec2(
            sin(q.x * 1.9 + q.y * 0.7) + sin(q.x * 0.43 - q.y * 2.3) + (hzN2(q * 3.1) - 0.5),
            cos(q.y * 1.6 + q.x * 0.5) + cos(q.x * 2.7 + q.y * 1.1) + (hzN2(q * 3.1 + 9.0) - 0.5)
          );
          vec3 hzNn = normalize(vec3(hzRip.x * hzAmp, 1.0, hzRip.y * hzAmp));
          vec3 hzRf = reflect(hzV, hzNn);
          hzRf.y = abs(hzRf.y) + 0.002;
          float hzFr = 0.04 + 0.96 * pow(1.0 - max(dot(-hzV, hzNn), 0.0), 5.0);
          vec3 hzRefl = hzSky(normalize(hzRf), 0.0);
          vec3 hzDeep = mix(vec3(0.015, 0.06, 0.075), vec3(0.004, 0.01, 0.02), uNight) * (0.35 + 0.65 * uDay);
          // shallow turquoise along the shore by day
          hzDeep = mix(hzDeep, vec3(0.05, 0.2, 0.2) * uDay, smoothstep(-2.5, 0.0, hzWdM) * 0.6);
          // the real Gulf: its turquoise shallows and the reef lines around the islands, dimmed with the light
          hzDeep = mix(hzDeep, hzSatLin * 0.55 * (0.25 + 0.75 * uDay) * mix(1.0, 0.25, uNight), hzFar * 0.75);
          // the real Gulf reflects a little less, so its colour (and the shoreline) still reads at grazing angles
          vec3 hzWaterC = mix(hzDeep, hzRefl * 0.8, clamp(hzFr * mix(1.1, 0.4, hzFar) + 0.08, 0.0, 1.0));
          // the sun's glitter path: a broad specular lobe from the flat sea, broken up by the ripples
          float hzGl = max(dot(reflect(hzV, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0);
          float hzSpark = 0.4 + 1.2 * hzN2(q * 2.3 + hzRip * 0.6);
          vec3 hzSunC = mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 0.5, 0.2), uGolden);
          hzWaterC += hzSunC * (pow(hzGl, 90.0) * 2.5 + pow(hzGl, 14.0) * 0.25) * hzSpark * uSunVis;
          // warm shimmer of the city lights on the water at night
          hzWaterC += vec3(1.0, 0.6, 0.3) * smoothstep(0.0, 0.6, uLights) * 0.06 * (0.5 + 0.5 * sin(q.x * 3.0 + hzRip.x * 2.0)) * smoothstep(-6.0, 0.0, hzWdM);
          outgoingLight = mix(outgoingLight, hzWaterC, hzWater);
        }
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => "hz-ground-3";
  return m;
}
