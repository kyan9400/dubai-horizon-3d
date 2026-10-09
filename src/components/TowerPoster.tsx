import { FLOORS, floorHalfSize, floorRotationDeg } from "@/lib/tower";

/* Code-made poster of the tower at golden hour. Server-rendered: it is the first thing on screen,
   the backdrop while the 3D warms up, and the fallback when WebGL is unavailable. */

const W = 800;
const H = 1000;
const GROUND = 820;
const TOP = 120;
const SCALE = 118; // px per scene unit of plate half-size

function towerBands() {
  const bands: { y: number; h: number; x0: number; xm: number; x1: number; sel: boolean }[] = [];
  const floorPx = (GROUND - 60 - TOP) / FLOORS;
  for (let f = 1; f <= FLOORS; f++) {
    const th = ((floorRotationDeg(f) + 20) * Math.PI) / 180;
    const size = floorHalfSize(f) * SCALE;
    // apparent width of a rotated superellipse, and where its lit corner sits
    const widen = 1 + 0.2 * Math.abs(Math.sin(2 * th));
    const half = size * widen;
    const split = Math.sin(2 * th - 0.6) * 0.45;
    const y = GROUND - 60 - f * floorPx;
    bands.push({
      y: +y.toFixed(1),
      h: +(floorPx - 1.4).toFixed(2),
      x0: +(W / 2 - half).toFixed(1),
      xm: +(W / 2 + half * split).toFixed(1),
      x1: +(W / 2 + half).toFixed(1),
      sel: f === 48,
    });
  }
  return bands;
}

function city() {
  const out: { x: number; w: number; h: number }[] = [];
  let x = 0;
  let seed = 7;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (x < W) {
    const w = 14 + r() * 34;
    const tall = r() < 0.15;
    const h = tall ? 50 + r() * 90 : 10 + r() * 36;
    if (Math.abs(x + w / 2 - W / 2) > 230) out.push({ x: +x.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) });
    x += w + 2 + r() * 6;
  }
  return out;
}

const BANDS = towerBands();
const CITY = city();
const TOP_BAND = BANDS[BANDS.length - 1];

export function TowerPoster({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Illustration of Horizon Tower at golden hour, its floors turning as they rise above a lagoon."
    >
      <defs>
        <linearGradient id="hz-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a36" />
          <stop offset="0.45" stopColor="#3a4672" />
          <stop offset="0.78" stopColor="#c9775a" />
          <stop offset="1" stopColor="#f29a55" />
        </linearGradient>
        <radialGradient id="hz-sun" cx="0.18" cy="0.8" r="0.5">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.95" />
          <stop offset="0.2" stopColor="#ff9a4d" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff9a4d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hz-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3346" />
          <stop offset="1" stopColor="#0d1218" />
        </linearGradient>
        <linearGradient id="hz-lit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f1b26c" />
          <stop offset="1" stopColor="#b77d52" />
        </linearGradient>
        <linearGradient id="hz-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b4258" />
          <stop offset="1" stopColor="#1b2030" />
        </linearGradient>
      </defs>
      <rect width={W} height={GROUND} fill="url(#hz-sky)" />
      <rect width={W} height={GROUND} fill="url(#hz-sun)" />
      <circle cx="150" cy="790" r="22" fill="#ffe2b0" />
      <g fill="#2a2a3c">
        {CITY.map((b, i) => (
          <rect key={i} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <rect y={GROUND} width={W} height={H - GROUND} fill="url(#hz-water)" />
      {/* podium */}
      <path d={`M${W / 2 - 300} ${GROUND} L${W / 2 + 300} ${GROUND} L${W / 2 + 280} ${GROUND - 60} L${W / 2 - 280} ${GROUND - 60} Z`} fill="#4a4250" />
      <rect x={W / 2 - 270} y={GROUND - 64} width="540" height="6" fill="#6d7958" />
      {/* tower */}
      <g>
        {BANDS.map((b, i) => (
          <g key={i}>
            <rect x={b.x0} y={b.y} width={b.xm - b.x0} height={b.h} fill={b.sel ? "#f1bd6b" : "url(#hz-lit)"} />
            <rect x={b.xm} y={b.y} width={b.x1 - b.xm} height={b.h} fill={b.sel ? "#5cc2be" : "url(#hz-shade)"} />
          </g>
        ))}
      </g>
      {/* crown + spire */}
      <path
        d={`M${TOP_BAND.x0 + 8} ${TOP_BAND.y} L${TOP_BAND.x0 + 30} ${TOP_BAND.y - 120} L${TOP_BAND.x1 - 20} ${TOP_BAND.y - 40} L${TOP_BAND.x1 - 6} ${TOP_BAND.y} Z`}
        fill="#d2bb8c"
        opacity="0.85"
      />
      <rect x={W / 2 - 1.5} y={TOP_BAND.y - 190} width="3" height="80" fill="#d2bb8c" />
      <circle cx={W / 2} cy={TOP_BAND.y - 192} r="4" fill="#ff4a3a" />
      {/* reflection */}
      <g opacity="0.22" transform={`translate(0 ${2 * GROUND}) scale(1 -1)`}>
        {BANDS.filter((_, i) => i % 3 === 0).map((b, i) => (
          <rect key={i} x={b.x0} y={b.y} width={b.x1 - b.x0} height={b.h * 2} fill="#f1b26c" />
        ))}
      </g>
    </svg>
  );
}
