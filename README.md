# Horizon Tower — explore a twisting tower in 3D

A concept sales-gallery site for **Horizon Tower**, a fictional 72-level residential tower on a fictional waterfront in
Dubai. Instead of a rendered brochure, the visitor explores the building itself: choose a level, choose a residence,
and drag the sun across the sky to see how the light falls on each facade.

**Live:** https://dubai-horizon-3d.vercel.app

> Concept project — fictional brand. Horizon Tower, Lumen Quay, every price and every figure are invented.

## Signature 3D moment — the Tower Explorer

- **Procedural tower.** Every floor plate is a superellipse that tapers with height and turns 1.25° from the one below:
  72 levels, a 90° quarter turn. The whole tower is two `InstancedMesh` draw calls plus one for 2,880 facade fins.
- **Facade in the shader.** The glass material is a `MeshStandardMaterial` patched with `onBeforeCompile`: mullions,
  spandrels and fins come from object-space position; lit windows at night are a per-instance hash on `gl_InstanceID`;
  the chosen level glows gold and the chosen residence's sector glows teal, all through uniforms.
- **Real sun path.** The time slider drives the equinox solar position for 25.2° N (Dubai). A custom sky shader blends
  day, golden hour, blue hour and a starry night; fog, sun colour, environment intensity and city lights follow.
- **Context city.** An instanced district (one draw call), taller and denser toward "Downtown", with night windows from
  world-space position, a lagoon, quay lights and a causeway.
- **Real ground: the Dubai coast from NASA Landsat.** Beyond the fictional quay the ground is real satellite data: a
  median composite of six clear NASA HLS L30 (Landsat 8/9) passes, rotated so the shore lines up with the scene's sea
  edge and drawn at half scale, so the Palm Jumeirah, Palm Jebel Ali, The World islands and the city grid show from the
  hero view. A derived mask turns the real sea into the reflective water shader and lights the real built-up areas
  sodium-orange after dusk; the day/night slider tints and relights it. 2048 px on the high tier, 1024 px otherwise
  (~1 MB in total), loaded with the 3D chunk behind the poster. Credited "Imagery: NASA" in the Location section.
- **Camera.** OrbitControls with glides: a new level moves the orbit target, a new residence swings the camera to face
  that facade; dragging cancels the swing.
- **No HDRI.** Reflections come from a code-made environment cube of the live sky (no HDRI download).

## Performance

- `frameloop="demand"`: frames only on control changes, drags, glides, the intro and the "Play a day" time-lapse
  (which pauses off-screen and in hidden tabs). An idle page renders nothing.
- Quality tier chosen **before** the Canvas exists (GPU name via `WEBGL_debug_renderer_info`, core/memory hints,
  coarse pointer; `?quality=low|medium|high` overrides). High: DPR 2, on-change shadow map. Medium: DPR 1.5, no shadows.
  Low: DPR 1, no AA, no fins, fewer buildings.
- Adaptive resolution measured only over consecutive frames, so on-demand pauses are never mistaken for slowness.
- The scene mounts in slices (tower, city, the rest), yielding to the main thread between them; shaders are then compiled
  with `gl.compileAsync` behind a code-made poster, and the canvas fades in with opacity only.
- The 3D chunk (three + r3f + drei) is loaded with `next/dynamic({ ssr: false })` only after window `load` plus an idle
  callback, never during hydration. A throwaway WebGL probe (no three import) runs first: software renderers
  (SwiftShader, llvmpipe, Microsoft Basic Render, or a `failIfMajorPerformanceCaveat` refusal) never load it and keep the
  poster. `?quality=low|medium|high` forces the 3D on.
- Native scrolling only: no scroll-smoothing library, no GSAP, no `backdrop-filter`.
- Full motion by default on a first visit; the header "Reduce motion" toggle switches it off (saved in
  localStorage and respected on later visits, `?motion=full|reduced` overrides). Reduced motion = no intro sweep, cuts instead of glides, no time-lapse.
- No WebGL, a software renderer or a lost context: the designed poster stays and the residence finder keeps working (it is plain DOM).

## Tech stack

Next.js 16.3.6 (App Router, `src/`) · React 19.3.0 · three 0.186.1 · @react-three/fiber 9.8.1 · @react-three/drei
10.7.9 · Tailwind CSS 4.3.3 · TypeScript 5.9.3 · ESLint 9.39.5 (`eslint-config-next` core-web-vitals).

GSAP, Lenis and @react-three/postprocessing from the shared stack are intentionally **not installed**: the site uses
native scrolling and no post-processing, which keeps the bundle smaller.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm run build:pages   # static GitHub Pages mirror in out/ (base path /dubai-horizon-3d)
```

Set `NEXT_PUBLIC_SITE_URL` to the deployed URL for absolute Open Graph links.

## Project layout

```
src/app/                 layout, page, 404, social preview (opengraph-image.png / twitter-image.png), icon, robots, sitemap, global styles
src/components/          header, explorer controls + stage, poster, map
src/components/three/    Scene, Tower, World (sky, ground, city, lights), Selection, CameraRig, materials, geometry
src/lib/                 tower data model, sun math, quality tiers, motion preference, store
```

## Credits

All 3D and illustration are made in code for this project; the ground imagery is NASA Landsat data (public domain).
Fonts: Bodoni Moda and Manrope (SIL OFL).
See [CREDITS.md](CREDITS.md).

## Copyright

© 2026 Alhassan Alfarran. All rights reserved — see [LICENSE](LICENSE).
