# Credits

Horizon Tower contains **no third-party 3D models, HDRIs, video or audio**. The tower, the quay, the nearby city, the
lagoon, sky and stars are procedural geometry and shaders; the poster, map and favicon are code-drawn SVG. The Open
Graph / Twitter image is a screenshot of the live site. The only outside imagery is the NASA satellite ground below.

## Fonts (self-hosted at build time via `next/font/google`)

| Font | Designer | License |
|---|---|---|
| Bodoni Moda | Owen Earl (indestructible type*) | SIL Open Font License 1.1 |
| Manrope | Mikhail Sharanda | SIL Open Font License 1.1 |

## npm libraries

| Package | License |
|---|---|
| next, react, react-dom | MIT |
| three | MIT |
| @react-three/fiber, @react-three/drei (and its dependency three-stdlib) | MIT |
| tailwindcss, @tailwindcss/postcss | MIT |
| typescript | Apache-2.0 |
| eslint, eslint-config-next | MIT |

Full dependency licenses are listed in `package-lock.json` / each package's own `LICENSE`.

## NASA satellite imagery (public domain)

| File | What | Source | Licence |
|---|---|---|---|
| `public/textures/dubai-coast-nasa-landsat.jpg` (2048 px), `-1k.jpg` (1024 px) | True-colour ground around the tower: the real Dubai coast from Jebel Ali to Deira, with the Palm Jumeirah, Palm Jebel Ali and The World islands | NASA Harmonized Landsat Sentinel-2 (HLS) **L30** product (Landsat 8/9 OLI only, layer `HLS_L30_Nadir_BRDF_Adjusted_Reflectance`), served by NASA GIBS / Worldview: https://gibs.earthdata.nasa.gov, https://worldview.earthdata.nasa.gov. Per-pixel median of six clear passes (27 Nov 2023 to 2 Mar 2024) | NASA imagery and data, US Government work, public domain (NASA Earth Science data have no use restrictions) |
| `public/textures/dubai-coast-mask.jpg` | Water / built-up mask derived from the image above (used for the sea and the night lights) | Derived for this project from the same NASA data | Public domain source |

The image was cropped, rotated about 35° (so the shore runs along the scene's sea edge), resampled to 25 m per pixel
and drawn at half scale around the fictional Lumen Quay. Credited on the page as "Imagery: NASA". No ESA /
Copernicus Sentinel-2 data is used (the HLS S30 layer was deliberately left out).

## CC0 assets

None used.
