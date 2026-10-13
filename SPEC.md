# Horizon Tower — SPEC

Concept project — fictional brand. Owner: Alhassan Alfarran (© 2026).

## 1. Concept

**Horizon Tower** is a fictional 72-level residential tower on a fictional waterfront plot, *Lumen Quay*, in Dubai.
Every floor plate turns 1.25° from the one below, so the tower completes a quarter turn (90°) between the podium and the
crown. The site is a sales-gallery experience in the browser: instead of a rendered brochure, the visitor explores the
building itself — picks a level, picks a residence, and drags the sun across the sky to see how the light falls.

Tone: quiet luxury. Dark "Gulf night" canvas, warm sand typography, one saffron-gold accent, a lagoon-teal highlight
reserved for "your residence". Editorial serif headlines (Bodoni Moda) over a precise geometric sans (Manrope).

## 2. Audience

- Primary: studio clients and recruiters viewing a creative-developer portfolio — they should remember the tower.
- In-fiction: high-net-worth buyers and their advisors browsing on phones and laptops; they want floor, view, size,
  indicative price, and a way to book a private viewing.

## 3. Sections (6 + footer)

| # | id | Section | Purpose |
|---|----|---------|---------|
| 1 | `#explore` | Hero + Tower Explorer | Signature 3D moment. Headline, floor selector, residence picker, time-of-day slider. |
| 2 | `#tower` | The Tower | Architecture story of the twist + four key figures. |
| 3 | `#residences` | Residences (light section) | Four collections with sizes and indicative prices. |
| 4 | `#amenities` | Sky Amenities | The five shared levels, as a vertical "section cut" list. |
| 5 | `#location` | Location | Code-made SVG schematic map + indicative drive times. |
| 6 | `#enquire` | Private Viewings | Contact actions (email, WhatsApp, Telegram) + studio credit. |
| — | footer | Footer | © 2026 Alhassan Alfarran · Concept project — fictional brand. |

Plus: custom 404 ("Level not found"), skip link, sticky header with section nav and the motion toggle.

## 4. Signature 3D moment — the Tower Explorer

**Technique (all procedural, zero downloaded assets):**
- Floor plate = rounded, chamfered square `Shape`; tapering from 3.3 to 2.5 scene units across the height.
- 72 floors drawn as two `InstancedMesh`es (glass band + slab edge), each instance rotated `i × 1.25°` and scaled by
  its taper. 2 draw calls for the whole tower.
- Glass material = `MeshStandardMaterial` patched with `onBeforeCompile`: the facade pattern (vertical fins, mullions,
  spandrels) is computed in the fragment shader from object-space position; lit windows at night are a per-instance
  hash using `gl_InstanceID`, faded in by a `uNight` uniform. The selected level is tinted gold and the selected
  residence's sector glows teal — both via uniforms, no extra materials.
- Selection overlay: a gold outline loop around the chosen level and a translucent teal volume over the chosen
  residence (sector of the floor plate, rebuilt only when the selection changes).
- Crown: a lit fin crown + aviation beacon. Podium, lagoon ring and a 2-lane causeway.
- Context city: every lot (block, round tower, stepped tower) baked once into one static world-space mesh (1 draw call; tint,
  glass flag and seed as vertex attributes) with facade, roof and window-light patterns in the shader.
- Sky: back-face sphere shader with real solar geometry — sun position from the equinox solar path at 25.2° N,
  hour 05:00–23:00. Day → golden hour → blue hour → night with procedural stars. Fog and the sun light colour follow.
- Lighting: one directional sun (+ shadow map on high tier only, updated only on change), hemisphere fill, and a
  code-made reflection cube that renders the sky dome itself (plus two soft light panels) for glass reflections (no HDRI download).
  The cube (6 passes + three's PMREM blur) is re-rendered only when the hour changes (throttled to ~8/s while scrubbing or
  playing), never on camera-only frames.
- Camera: OrbitControls (damped, clamped polar + distance). Changing level glides the orbit target to that level;
  picking a residence swings the camera to face that facade. Dragging cancels any glide.

**Look (visual redesign, 2026-10).** The first frame is an establishing shot at sunset (18:15, sun 1° above the Gulf):
the whole tower, crown and spire seen from the east-south-east, with the sun, a glitter path on the sea and thin cirrus
behind it. The setting is laid out by one set of functions shared by the ground shader and the building placement: the
Gulf to the west, a winding creek north of the quay, the round lagoon, a 6-unit street grid with boulevards, parks and
beaches, and desert dunes beyond the city edge. The context city is one merged draw call (blocks, round towers,
stepped towers) on 2 × 2 lots per block, with a tall glass downtown to the south, a marina skyline on the coast and a low
stone quarter across the creek; facades, roofs and window lights come from the shader. Water reflects the same analytic
sky as the dome (ripples, Fresnel, sun glitter), and the reflection cube now renders that sky dome, so all glass mirrors
the real time of day. The tower glass is cleaner (thin bronze slabs, fewer frame bands), the sky gardens at L22/L46/L71
are set back and lit, the crown blades are taller, and additive halos sit on the crown and the beacon. A `uLights` level
(already ~0.6 at sunset) lights windows, streets and the quay in stages. Scroll story (desktop, full motion): while the
explorer column scrolls past the sticky stage, the camera closes in from the establishing shot to the selected level.

**Controls (DOM, outside the canvas, keyboard accessible):** level slider (1–72) with −/+ buttons; residence buttons
(4 per floor, 2 on penthouse floors, an amenity card on shared levels); time slider + Day / Golden hour / Night presets;
"Play a day" time-lapse (full motion only). Readouts use `aria-live="polite"`.

**Quality tiers (decided before the Canvas exists):**
| | high | medium | low |
|---|---|---|---|
| DPR cap | 2 | 1.5 | 1 |
| Antialias | yes | yes | no |
| Sun shadow map | 2048, on-change only | off (baked contact shadow) | off |
| Context buildings | 520 | 320 | 140 |
| Reflection cube size | 256 | 64 | 32 |

GPU name via `WEBGL_debug_renderer_info` (probed after window `load` + idle, without importing three): software
renderer (SwiftShader, llvmpipe, Basic Render, or a `failIfMajorPerformanceCaveat` refusal) → no 3D chunk at all, the
poster stays; Intel/AMD integrated, Mali, Adreno, PowerVR → ≤ medium;
coarse pointer → ≤ medium. `?quality=low|medium|high` overrides and forces the 3D on. drei `<PerformanceMonitor>` lowers DPR on decline.

**Render on demand:** `frameloop="demand"`; frames only on control change, camera drag, an active glide, the intro
sweep, or the time-lapse. Time-lapse pauses when the canvas leaves the viewport or the tab hides.

**Reduced motion:** default follows `prefers-reduced-motion`; header toggle "Turn on full motion" (stored in
localStorage, `?motion=full|reduced` overrides). Reduced = no intro sweep, level/residence changes cut instead of
glide, no time-lapse button. All controls still work.

**Warm-up:** the poster stays visible with a "Composing the skyline" status while the scene mounts in
slices (yielding between them) and compiles (`gl.compileAsync`), then the canvas fades in (opacity only). The scene stays
hidden and nothing is drawn until every slice is mounted and compiled (a render gate), so each program is compiled once, in
parallel, with the final lights, shadow type and environment.

**No-WebGL / software renderer / context lost:** a designed code-made SVG poster of the hero's sunset establishing shot (twisted tower, sun and glitter path on the Gulf,
cirrus, beach, creek, lagoon ring and the lit city grid; ~35 KB inline, ~10 KB gzip) stays in place (with a short
note when WebGL is missing or lost); the residence finder (level, residence, details) keeps working because it is plain DOM.

## 5. Design system

**Palette**
| token | hex | use |
|---|---|---|
| `night-950` | `#0A0C11` | page background |
| `night-900` | `#11141B` | panels |
| `night-800` | `#1A1E28` | raised controls |
| `night-700` | `#2A303D` | hairlines |
| `sand-50` | `#F6F0E6` | primary text on dark |
| `sand-300` | `#CDBFAA` | secondary text on dark (≈10:1) |
| `sand-100` | `#EFE6D8` | light section background |
| `gold-400` | `#E2AE5E` | accent on dark (≈9.6:1) |
| `gold-700` | `#7A561C` | accent on light (≈5.6:1) |
| `lagoon-400` | `#5CC2BE` | "your residence" highlight |
| `ink-900` | `#16130F` | text on light |

**Fonts** (Google Fonts, OFL, via `next/font`): Bodoni Moda (display, 400/600 + italic) · Manrope (UI/body, 400/500/700).

**Spacing scale** (4 px base): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128. Section padding: 96 desktop / 64 mobile.
Gutter 16 px at ≤ 480 px, 24 px tablet, 48 px desktop. Radius: 2 px (architectural, not bubbly). Type scale:
12 / 14 / 16 / 20 / 28 / 40 / 56 / 88 (clamp-based).

## 6. Final copy

**Header nav:** Explore · Tower · Residences · Amenities · Location · Private viewings. Motion button: "Turn on full motion" / "Reduce motion".

**1 · Hero / Explorer**
- Eyebrow: "Lumen Quay, Dubai — Completion Q4 2029"
- H1: "Seventy-two levels. One turning horizon."
- Lede: "Horizon Tower turns a quarter circle on its way to the sky, so every residence faces its own view. Choose a
  level, choose a home, and move the sun to see how the light arrives."
- Control labels: "Level", "Residences on this level", "Time of day", presets "Day", "Golden hour", "Night", "Play a day".
- Status: "Composing the skyline…"; fallback: "Interactive 3D is not available on this device. The residence finder
  below still works."
- Bands: L1 "Arrival Lobby", L2 "Residents' Lounge", L3–21 "Garden Residences", L22 "Garden Deck", L23–45 "Sky
  Residences", L46 "Wellness Level", L47–62 "Horizon Suites", L63–70 "Penthouses", L71 "Crown Pool", L72 "Observatory".
- Facades: north "Creek & Old Dubai", east "Desert dawn", south "Downtown skyline", west "Arabian Gulf sunsets".

**2 · The Tower**
- H2: "A quarter turn, floor by floor."
- Body: "Each floor plate rotates 1.25° from the one beneath it. Over 72 levels the tower completes a 90° turn —
  enough to give the upper residences a corner view of the Gulf, and to let the facade shade itself through the
  hottest hours. Vertical fins in brushed champagne aluminium are angled to the sun path: closed to the south at
  noon, open to the west at dusk."
- Figures: "288 m" height · "72" levels · "90°" total turn · "214" residences.

**3 · Residences**
- H2: "Four collections, one address."
- Garden Residences — L3–21 — "One and two bedrooms above the podium gardens." — 78–132 m² — From AED 2.4 M
- Sky Residences — L23–45 — "Two and three bedrooms with full-height glass." — 128–196 m² — From AED 4.1 M
- Horizon Suites — L47–62 — "Three bedrooms on the corner, two facades of view." — 205–260 m² — From AED 7.8 M
- Penthouses — L63–70 — "Half-floor homes with private terraces and a plunge pool." — 410–520 m² — From AED 19 M
- Note: "Indicative figures for a fictional concept project."

**4 · Sky Amenities**
- H2: "Shared levels, placed where the views are best."
- L1 Arrival Lobby — "A triple-height hall in travertine and smoked oak, with a 24-hour concierge."
- L22 Garden Deck — "Shaded gardens, a children's club and a 25 m lap pool."
- L46 Wellness Level — "Hammam, spa suites, a strength studio and a quiet library."
- L71 Crown Pool — "An infinity pool turned towards the Gulf sunset."
- L72 Observatory — "A members' lounge at 284 m, with a telescope deck for clear winter nights."

**5 · Location**
- H2: "On the water, ten minutes from everything."
- Body: "Lumen Quay sits on a calm stretch of the creek, with a waterfront promenade, a marina for day boats and a
  direct road to the city's main arteries."
- Drive times (indicative): Downtown 10 min · International airport 14 min · Business district 12 min · Marina &
  beaches 24 min · Desert conservation reserve 35 min.

**6 · Private Viewings**
- H2: "See the light for yourself."
- Body: "Viewings of the sales gallery and the full-scale show residence are by appointment."
- Actions: "Email the studio", "WhatsApp", "Telegram".
- Credit: "Concept, design and 3D development by Alhassan Alfarran." Links: Portfolio · GitHub.

**Footer:** "© 2026 Alhassan Alfarran" · "Concept project — fictional brand." · "Horizon Tower, Lumen Quay and all
figures are fictional."

**404:** H1 "Level not found." · "This floor was never built. The lifts still run to the lobby." · "Back to the tower".

## 7. Assets & licenses

| asset | source | license |
|---|---|---|
| All 3D geometry, materials, sky, city | code in `src/components/three/` | project (all rights reserved) |
| Fallback poster, map, icon, OG image | code (inline SVG / `next/og`) | project |
| Bodoni Moda, Manrope | Google Fonts via `next/font` | SIL OFL 1.1 |
| npm libraries | see package.json | MIT |

No downloaded models, textures, HDRIs, images or audio.

## 8. Performance budget

- Route first-load JS < 250 KB gzip, excluding the lazy 3D chunk (three + r3f + drei) which loads after window `load` + idle.
- LCP element = H1 text (server-rendered). Fonts `display: swap`, two families.
- 3D: ≤ 16 draw calls per camera frame (the reflection cube + PMREM, ~35 more, only on frames where the hour changed), ≤ 120 k triangles, no textures (all procedural in shader), shadow map only on high tier.
- Idle tab = 0 frames rendered. No scroll smoothing library (native scroll), no GSAP needed.
- CSS: only `transform`/`opacity` animated, no `backdrop-filter` anywhere.
- Lighthouse mobile targets: Performance ≥ 85, Accessibility/Best Practices/SEO ≥ 95.
