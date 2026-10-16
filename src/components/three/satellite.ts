import * as THREE from "three";

/* Real ground around the fictional quay: a NASA Landsat (HLS L30) composite of the Dubai coast, with the Palm Jumeirah
   and the city grid, rotated so the shore runs along the scene's sea edge. Served from /public, loaded with the 3D chunk.
   uSat: colour (sRGB values, decoded in the shader). uSatMask: R = water, G = built-up (night lights).
   If either file fails, uSatOn stays 0 and the procedural desert is drawn instead. */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** 2048 px on the high tier, 1024 px on medium / low */
const satUrl = (hi: boolean) => `${BASE}/textures/dubai-coast-nasa-landsat${hi ? "" : "-1k"}.jpg`;
const SAT_MASK_URL = `${BASE}/textures/dubai-coast-mask.jpg`;
/** World units covered by the image: 52 km of real coast drawn at half scale (20 m per unit, the tower is at 10 m per
    unit), so the Palm Jumeirah and the shoreline sit within the camera's view instead of beyond the haze. */
export const SAT_SIZE = 2600;

export interface SatUniforms {
  uSat: { value: THREE.Texture };
  uSatMask: { value: THREE.Texture };
  uSatOn: { value: number };
}

function blank() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

export function loadSatellite(hi: boolean): Promise<SatUniforms> {
  const loader = new THREE.TextureLoader();
  const prep = (t: THREE.Texture) => {
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return Promise.all([loader.loadAsync(satUrl(hi)), loader.loadAsync(SAT_MASK_URL)])
    .then(([c, m]) => ({ uSat: { value: prep(c) }, uSatMask: { value: prep(m) }, uSatOn: { value: 1 } }))
    .catch(() => ({ uSat: { value: blank() }, uSatMask: { value: blank() }, uSatOn: { value: 0 } }));
}
