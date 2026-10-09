import * as THREE from "three";
import { GLASS_H } from "@/lib/tower";

/* Shared uniforms: written by the scene controllers when the store changes, read by every patched material. */
export function createUniforms() {
  return {
    uNight: { value: 0 },
    uDay: { value: 1 },
    uSel: { value: 47 },
    uUnitC: { value: 0 },
    uUnitHalf: { value: 0.78 },
    uUnitOn: { value: 1 },
    uGlassH: { value: GLASS_H },
  };
}
export type SharedUniforms = ReturnType<typeof createUniforms>;

const HEAD = /* glsl */ `
uniform float uNight;
uniform float uDay;
uniform float uSel;
uniform float uUnitC;
uniform float uUnitHalf;
uniform float uUnitOn;
uniform float uGlassH;
float hzHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

/** Tower glass: facade pattern, lit windows, selected level and residence — all computed in the shader. */
export function createGlassMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.9, roughness: 0.08, envMapIntensity: 1.25 });
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
        float hzMull = smoothstep(0.0, 0.06, hzCf) * (1.0 - smoothstep(0.94, 1.0, hzCf));
        float hzBand = 1.0 - smoothstep(0.79, 0.83, hzY);
        float hzMask = hzMull * hzBand;
        float hzSel = 1.0 - step(0.5, abs(vHzInst - uSel));
        float hzD = abs(atan(sin(hzAng - uUnitC), cos(hzAng - uUnitC)));
        float hzUnit = hzSel * uUnitOn * (1.0 - step(uUnitHalf, hzD));
        float hzR = hzHash(vec2(vHzInst, hzCol));
        float hzR2 = hzHash(vec2(hzCol * 0.37, vHzInst * 1.7));
        float hzLit = step(hzR, 0.16 + 0.52 * uNight) * uNight;
        vec3 hzWarm = mix(vec3(1.0, 0.66, 0.36), vec3(1.0, 0.86, 0.66), hzR2);
        vec3 hzGlass = mix(vec3(0.46, 0.56, 0.63), vec3(0.16, 0.2, 0.25), uNight);
        hzGlass *= 0.9 + 0.2 * hzR2;
        vec3 hzFrame = vec3(0.82, 0.72, 0.55);
        diffuseColor.rgb = mix(hzFrame, hzGlass, hzMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.7, 0.34), hzSel * (1.0 - hzMask) * 0.85);`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.55, 0.94, hzMask);
        roughnessFactor = mix(0.4, 0.05 + 0.05 * hzR2, hzMask);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += hzWarm * hzLit * hzMask * (0.7 + 0.9 * hzR2) * (1.0 - hzUnit);
        totalEmissiveRadiance += vec3(0.95, 0.66, 0.28) * hzSel * (0.12 + 0.75 * uNight) * (1.0 - hzMask * 0.55);
        totalEmissiveRadiance += vec3(0.3, 0.86, 0.82) * hzUnit * hzMask * (0.5 + 0.7 * uNight);`
      );
  };
  m.customProgramCacheKey = () => "hz-glass";
  return m;
}

/** Slab edges between levels; the selected level's slab glows softly gold. */
export function createSlabMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#d9cdb6", roughness: 0.55, metalness: 0.15 });
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
        totalEmissiveRadiance += vec3(0.9, 0.75, 0.55) * uNight * 0.05;`
      );
  };
  m.customProgramCacheKey = () => "hz-slab";
  return m;
}

/** Context city: window lights at night, from world position so every block gets a believable grid. */
export function createCityMaterial(u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzWorld;\nvarying vec3 vHzN;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 hzWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hzWp = instanceMatrix * hzWp;
        #endif
        vHzWorld = (modelMatrix * hzWp).xyz;
        vHzN = normal;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzWorld;\nvarying vec3 vHzN;" + HEAD)
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        float hzSide = 1.0 - step(0.5, abs(vHzN.y));
        float hzRow = floor(vHzWorld.y / 0.32);
        float hzColW = floor((vHzWorld.x + vHzWorld.z) / 0.26);
        vec2 hzF = fract(vec2((vHzWorld.x + vHzWorld.z) / 0.26, vHzWorld.y / 0.32));
        float hzWin = step(0.2, hzF.x) * step(hzF.x, 0.8) * step(0.25, hzF.y) * step(hzF.y, 0.75);
        float hzOn = step(hzHash(vec2(hzRow, hzColW)), 0.1 + 0.42 * uNight);
        vec3 hzTint = mix(vec3(1.0, 0.7, 0.4), vec3(0.85, 0.9, 1.0), step(0.8, hzHash(vec2(hzColW, hzRow + 3.1))));
        totalEmissiveRadiance += hzTint * hzSide * hzWin * hzOn * uNight * 0.85 * step(0.2, vHzWorld.y);
        diffuseColor.rgb *= mix(1.0, 0.55, uNight);`
      );
  };
  m.customProgramCacheKey = () => "hz-city";
  return m;
}
