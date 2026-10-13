import { FLOORS, floorHalfSize, floorRotationDeg } from "@/lib/tower";

/* Code-made poster of the 3D hero's establishing shot: the twisted tower at sunset beside the Gulf, the sun on the
   horizon with its glitter path, warm cirrus, the beach, the creek, the lagoon ring and the lit city grid.
   Server-rendered: it is the first thing on screen, the backdrop while the 3D warms up, and the fallback on software
   renderers or without WebGL. Everything below is computed once at module load (deterministic, no images).
   Square view box + `slice`: wide stages crop a little top and bottom, phones a little at the sides. */

const W = 1000;
const H = 1000;
const HZ = 122; // horizon
const SUN = { x: 418, y: HZ - 5 };
const CX = 500; // tower axis
const BASE = 818; // top of the podium
const CROWN = 236; // top of the last floor
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 10) / 10;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/* ground plane → screen: camera above the city looking north-west over the Gulf */
const F = 500;
const HF = H - HZ;
const sx = (X: number, Z: number) => CX + (X * F) / Z;
const sy = (Z: number) => HZ + HF / Z;
/** coast: depth of the waterline for a screen column (rises to the right, like the 3D beach) */
const coastZ = (u: number) => (3 / (1 - 0.36 * u)) * (1 + 0.035 * Math.sin(5.5 * u + 0.8));
const creekX = (Z: number) => 0.95 - 1.55 * (Z - 1.15) + 0.12 * Math.sin(Z * 4);
const CREEK_HALF = 0.075;

function coastPath() {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 25) pts.push(`${x} ${r1(sy(coastZ((x - CX) / F)))}`);
  return pts;
}
const COAST = coastPath();
const LAND = `M${COAST.join(" L")} L${W} ${H} L0 ${H}Z`;
// the beach: a band just inside the waterline
const BEACH = `M${COAST.join(" L")} ${COAST.slice()
  .reverse()
  .map((p) => {
    const [x, y] = p.split(" ").map(Number);
    return `L${x} ${r1(y + 10 + (y - HZ) * 0.07)}`;
  })
  .join(" ")}Z`;

function creekPath() {
  const left: string[] = [];
  const right: string[] = [];
  for (let Z = 1.0; Z <= 3.4; Z += 0.08) {
    const X = creekX(Z);
    const u = (sx(X, Z) - CX) / F;
    if (Z > coastZ(u) + 0.05) break;
    left.push(`${r1(sx(X - CREEK_HALF, Z))} ${r1(sy(Z))}`);
    right.push(`${r1(sx(X + CREEK_HALF, Z))} ${r1(sy(Z))}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")}Z`;
}
const CREEK = creekPath();

/** street grid in perspective (clipped to the land in the SVG) */
function roads() {
  let d = "";
  for (let X = -3; X <= 3.001; X += 0.24) d += `M${r1(sx(X, 1))} ${r1(sy(1))}L${r1(sx(X, 4.6))} ${r1(sy(4.6))}`;
  for (let Z = 1; Z < 4.6; Z *= 1.085) d += `M0 ${r1(sy(Z))}H${W}`;
  return d;
}
const ROADS = roads();

interface Box {
  Z: number;
  tall: boolean;
  front: string;
  side: string;
  top: string;
  tone: number;
}

/** the context city: small extruded blocks on the grid, a taller glass cluster in the foreground. Integer, relative
    path commands keep it small; lit windows are a pattern laid over the facades. */
function city() {
  const rand = rng(29);
  const boxes: Box[] = [];
  for (let Z = 1.02; Z < 3.2; Z *= 1.06) {
    for (let X = -3; X < 3; X += 0.13) {
      if (rand() < 0.3 + (Z - 1) * 0.12) continue;
      const cx = X + 0.065 + (rand() - 0.5) * 0.03;
      const cz = Z * 1.03;
      const u = (sx(cx, cz) - CX) / F;
      if (u < -1.05 || u > 1.05) continue;
      if (cz > coastZ(u) - 0.18) continue; // keep the beach clear
      if (Math.abs(cx - creekX(cz)) < CREEK_HALF + 0.08) continue;
      if (Math.abs(cx) < 0.5 && cz < 1.62) continue; // lagoon and podium
      const core = Math.max(0, 1 - Math.hypot((cx + 0.9) / 0.9, (cz - 1.2) / 0.5)) + Math.max(0, 1 - Math.hypot((cx - 1.1) / 0.7, (cz - 1.5) / 0.6)) * 0.7;
      const tall = rand() < 0.02 + 0.45 * core;
      const w = tall ? 0.06 + rand() * 0.03 : 0.05 + rand() * 0.04;
      const h = tall ? 0.1 + rand() * 0.28 * (0.5 + core) : 0.012 + rand() * rand() * 0.06;
      const dz = 0.035;
      const x0 = r1(sx(cx - w / 2, cz));
      const fw = Math.max(2, r1(sx(cx + w / 2, cz) - x0));
      const yb = sy(cz);
      const hp = Math.max(1, r1((h * HF) / cz / 1.4));
      const yt = r1(yb - hp);
      // top face: the back edge one lot deeper
      const bx0 = sx(cx - w / 2, cz + dz) - x0;
      const bx1 = sx(cx + w / 2, cz + dz) - x0 - fw;
      const dy = r1(sy(cz + dz) - yb);
      const top = `M${x0} ${yt}h${fw}l${r1(bx1)} ${dy}h${r1(bx0 - bx1) - fw}z`;
      // the side facing the camera axis
      const sdx = r1(cx > 0 ? bx0 : bx1);
      const side = hp < 3 ? "" : `M${cx > 0 ? x0 : x0 + fw} ${yt}l${sdx} ${dy}v${hp}l${-sdx} ${-dy}z`;
      boxes.push({ Z: cz, tall, front: `M${x0} ${yt}h${fw}v${hp}h${-fw}z`, side, top, tone: Math.floor(rand() * 3) });
    }
  }
  boxes.sort((a, b) => b.Z - a.Z);
  // low blocks barely overlap: one path per fill. Tall ones are drawn one by one, far to near.
  const low = boxes.filter((b) => !b.tall);
  const join = (list: Box[], f: (b: Box) => string) => list.map(f).join("");
  return {
    lowSide: join(low, (b) => b.side),
    lowFront: [0, 1, 2].map((t) => join(low.filter((b) => b.tone === t), (b) => b.front)),
    lowTop: join(low, (b) => b.top),
    tall: boxes.filter((b) => b.tall),
  };
}
const CITY = city();

/** glitter path: short bright dashes under the sun, widening toward the shore */
function glitter() {
  const rand = rng(11);
  let d = "";
  for (let i = 0; i < 120; i++) {
    const t = Math.pow(rand(), 1.4);
    const y = HZ + 2 + t * 330;
    const spread = 6 + (y - HZ) * 0.42;
    const x = SUN.x + (rand() + rand() + rand() - 1.5) * spread * 0.9 - (y - HZ) * 0.12;
    const w = 3 + rand() * (8 + (y - HZ) * 0.06);
    d += `M${r1(x - w / 2)} ${r1(y)}h${r1(w)}v${y - HZ < 60 ? 1 : 2}h-${r1(w)}z`;
  }
  return d;
}
const GLITTER = glitter();

/** thin cirrus streaks fanning out from the sun */
function cirrus() {
  const rand = rng(5);
  const out: { d: string; o: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
    const r0 = 60 + rand() * 120;
    const r1_ = r0 + 120 + rand() * 260;
    const wdt = 3 + rand() * 7;
    const p = (r: number, o: number) => {
      const x = SUN.x + Math.cos(a) * r * 1.5 + Math.cos(a + Math.PI / 2) * o;
      const y = HZ - Math.abs(Math.sin(a) * r * 0.32) - 8 + Math.sin(a + Math.PI / 2) * o * 0.3;
      return `${r1(x)} ${r1(Math.max(4, y))}`;
    };
    out.push({ d: `M${p(r0, 0)}Q${p((r0 + r1_) / 2, wdt)} ${p(r1_, 0)}Q${p((r0 + r1_) / 2, -wdt)} ${p(r0, 0)}Z`, o: +(0.18 + rand() * 0.3).toFixed(2) });
  }
  return out;
}
const CIRRUS = cirrus();

/** the 72 twisted floors: lit and shaded share of each band, from the plate rotation */
function tower() {
  const scale = 37 / floorHalfSize(1);
  const floorPx = (BASE - CROWN) / FLOORS;
  const shade: string[] = [];
  const outline: string[] = [];
  const outlineR: string[] = [];
  for (let f = 1; f <= FLOORS; f++) {
    const th = ((floorRotationDeg(f) + 28) * Math.PI) / 180;
    const half = floorHalfSize(f) * scale * (1 + 0.16 * Math.abs(Math.sin(2 * th)));
    const split = Math.sin(2 * th - 0.4) * 0.5;
    const y = BASE - f * floorPx;
    const h = floorPx - 1.1;
    const x0 = CX - half;
    const xm = CX + half * split;
    const x1 = CX + half;
    shade.push(`M${r2(xm)} ${r2(y)}h${r2(x1 - xm)}v${r2(h)}h${r2(xm - x1)}z`);
    outline.push(`${r1(x0)} ${r1(y)}`, `${r1(x0)} ${r1(y + floorPx)}`);
    outlineR.push(`${r1(x1)} ${r1(y + floorPx)}`, `${r1(x1)} ${r1(y)}`);
  }
  const silhouette = `M${outline.join(" L")} L${outlineR.reverse().join(" L")}Z`;
  const bandY = (f: number) => r2(BASE - f * floorPx);
  const halfAt = (f: number) => r2(floorHalfSize(f) * scale * 1.06);
  return { shade: shade.join(""), silhouette, bandY, halfAt, floorPx };
}
const T = tower();

/** one tile of lit windows (3 floors tall), repeated over the tower */
function towerLights() {
  const h = r2(T.floorPx - 3.2);
  const at: [number, number][] = [[1.3, 0], [9.7, 0], [5.5, 1], [18.1, 1], [14, 2], [22.3, 2], [1.3, 2]];
  return at.map(([x, f]) => `M${x} ${r2(f * T.floorPx + 1.2)}h2.2v${h}h-2.2z`).join("");
}
const TOWER_LIGHTS = towerLights();

/** crown blades rising toward one corner, like the 3D crown */
function crown() {
  const top = T.bandY(FLOORS);
  const half = T.halfAt(FLOORS);
  let d = "";
  const n = 15;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const x = CX - half + t * half * 2;
    const h = 22 + 120 * Math.pow(0.5 + 0.5 * Math.cos((t - 0.38) * Math.PI * 1.6), 2);
    d += `M${r2(x - 1.3)} ${r2(top)}V${r2(top - h)}h2.6V${r2(top)}z`;
  }
  return { d, top, half };
}
const CROWN_BLADES = crown();

const TONES = ["#a28c86", "#8d7b7a", "#b39c92", "#7e6c5e"];

export function TowerPoster({ className = "" }: { className?: string }) {
  const c = CROWN_BLADES;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Illustration of Horizon Tower at sunset: the twisted tower above its lagoon, the city grid and the creek, with the sun setting over the Gulf behind it."
    >
      <defs>
        <linearGradient id="hz-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a7372" />
          <stop offset="0.55" stopColor="#c98d6f" />
          <stop offset="1" stopColor="#efa66a" />
        </linearGradient>
        <radialGradient id="hz-glow" cx={SUN.x} cy={SUN.y} r="430" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${SUN.x} ${SUN.y}) scale(1 0.55) translate(${-SUN.x} ${-SUN.y})`}>
          <stop offset="0" stopColor="#fff0c8" stopOpacity="0.95" />
          <stop offset="0.12" stopColor="#ffc27a" stopOpacity="0.7" />
          <stop offset="0.45" stopColor="#f39a5a" stopOpacity="0.25" />
          <stop offset="1" stopColor="#f39a5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hz-sea" x1="0" y1={HZ} x2="0" y2="560" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#de975f" />
          <stop offset="0.35" stopColor="#a8746a" />
          <stop offset="1" stopColor="#5f4b5a" />
        </linearGradient>
        <linearGradient id="hz-land" x1="0" y1="300" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ab948c" />
          <stop offset="0.35" stopColor="#8e7d7c" />
          <stop offset="1" stopColor="#6c5f63" />
        </linearGradient>
        <linearGradient id="hz-haze" x1="0" y1="260" x2="0" y2="640" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d6a184" stopOpacity="0" />
          <stop offset="0.3" stopColor="#d6a184" stopOpacity="0.55" />
          <stop offset="1" stopColor="#d6a184" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hz-lit" x1={CX - 40} y1="0" x2={CX + 40} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ebb672" />
          <stop offset="1" stopColor="#b97a42" />
        </linearGradient>
        <linearGradient id="hz-shade" x1={CX - 40} y1="0" x2={CX + 40} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9b6440" />
          <stop offset="1" stopColor="#5e3d2c" />
        </linearGradient>
        <linearGradient id="hz-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f8c95" />
          <stop offset="1" stopColor="#1f5662" />
        </linearGradient>
        <radialGradient id="hz-crown" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd28a" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ffb45a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb45a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hz-beacon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6a4a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff4a3a" stopOpacity="0" />
        </radialGradient>
        {/* fins and the dark slab line of every floor, then a scatter of lit windows (tiles aligned to the floors) */}
        <pattern id="hz-fins" y={CROWN} width="4.2" height={T.floorPx} patternUnits="userSpaceOnUse">
          <rect width="1.1" height={T.floorPx} fill="#3a2418" opacity="0.45" />
          <rect y={T.floorPx - 1.1} width="4.2" height="1.1" fill="#3a2418" opacity="0.5" />
        </pattern>
        <pattern id="hz-tlights" y={CROWN} width="25.2" height={T.floorPx * 3} patternUnits="userSpaceOnUse">
          <path d={TOWER_LIGHTS} fill="#ffe0a6" />
        </pattern>
        <pattern id="hz-cwin" width="15" height="13.5" patternUnits="userSpaceOnUse">
          <path d="M1 1.4h1.7v1.5H1zM6 5.9h1.7v1.5H6zM11 1.4h1.7v1.5H11zM11 10.4h1.7v1.5H11zM1 10.4h1.7v1.5H1z" fill="#ffca7e" />
        </pattern>
        <clipPath id="hz-landclip">
          <path d={LAND} />
        </clipPath>
        <path id="hz-sil" d={T.silhouette} />
        <clipPath id="hz-towerclip">
          <use href="#hz-sil" />
        </clipPath>
      </defs>

      {/* sky, sun and cirrus */}
      <rect width={W} height={HZ + 2} fill="url(#hz-sky)" />
      <g fill="#ffe2bc">
        {CIRRUS.map((s, i) => (
          <path key={i} d={s.d} opacity={s.o} />
        ))}
      </g>
      {/* the Gulf, its sky reflection and the glitter path */}
      <rect y={HZ} width={W} height={H - HZ} fill="url(#hz-sea)" />
      <g fill="#f7c79a" transform={`translate(0 ${2 * HZ}) scale(1 -1.25) translate(0 ${-HZ * 0.2})`} opacity="0.35">
        {CIRRUS.slice(0, 9).map((s, i) => (
          <path key={i} d={s.d} opacity={s.o} />
        ))}
      </g>
      <ellipse cx={SUN.x} cy={SUN.y} rx="430" ry="237" fill="url(#hz-glow)" />
      <circle cx={SUN.x} cy={SUN.y} r="13" fill="#fff4dc" />
      <rect y={HZ} width={W} height="1.5" fill="#f0b07a" opacity="0.8" />
      <path d={GLITTER} fill="#ffe6b8" opacity="0.8" />

      {/* land: beach, street grid, creek, haze */}
      <path d={LAND} fill="url(#hz-land)" />
      <g clipPath="url(#hz-landclip)">
        <path d={ROADS} stroke="#4a3f44" strokeWidth="1.2" fill="none" opacity="0.5" />
        <path d={CREEK} fill="url(#hz-water)" stroke="#9cc6c4" strokeWidth="1.5" strokeOpacity="0.6" />
      </g>
      <path d={BEACH} fill="#c9a891" />
      <path d={CITY.lowSide} fill="#5c4c4e" />
      {CITY.lowFront.map((d, i) => (
        <path key={i} d={d} fill={TONES[i]} />
      ))}
      <path d={CITY.lowTop} fill="#c7aea2" />
      {CITY.tall.map((b, i) => (
        <g key={i}>
          <path d={b.side} fill="#4f4144" />
          <path d={b.front} fill={TONES[3]} />
          <path d={b.front} fill="url(#hz-cwin)" />
          <path d={b.top} fill="#bda48f" />
        </g>
      ))}
      <rect y="260" width={W} height="380" fill="url(#hz-haze)" />

      {/* lagoon ring and quay lights around the podium */}
      <ellipse cx={CX} cy={BASE + 22} rx="158" ry="58" fill="#e8dccd" />
      <ellipse cx={CX} cy={BASE + 22} rx="146" ry="51" fill="url(#hz-water)" />
      <ellipse cx={CX} cy={BASE + 22} rx="140" ry="48" fill="none" stroke="#ffe0b0" strokeWidth="1.6" strokeDasharray="1.6 7" />
      <path d={`M${CX - 52} ${BASE + 6} L${CX + 52} ${BASE + 6} L${CX + 46} ${BASE - 4} L${CX - 46} ${BASE - 4}Z`} fill="#6b5446" />
      <path d={`M${CX - 46} ${BASE - 4} L${CX + 46} ${BASE - 4} L${CX + 44} ${BASE - 7} L${CX - 44} ${BASE - 7}Z`} fill="#6d7958" />

      {/* the tower: lit and shaded share of each twisted floor, fins, lit windows, sky gardens */}
      <use href="#hz-sil" fill="url(#hz-lit)" />
      <path d={T.shade} fill="url(#hz-shade)" />
      <g clipPath="url(#hz-towerclip)">
        <rect x={CX - 44} y={CROWN} width="88" height={BASE - CROWN} fill="url(#hz-fins)" />
        <rect x={CX - 44} y={CROWN} width="88" height={BASE - CROWN} fill="url(#hz-tlights)" opacity="0.75" />
      </g>
      {[22, 46, 71].map((f) => (
        <rect key={f} x={CX - T.halfAt(f)} y={T.bandY(f) - 1} width={T.halfAt(f) * 2} height="3.2" fill="#fff4de" />
      ))}
      <rect x={CX - T.halfAt(48) * 0.1} y={T.bandY(48) - 0.5} width={T.halfAt(48) * 0.75} height="2.2" fill="#7fe0d8" />

      {/* crown, spire, beacon and their halos */}
      <circle cx={CX} cy={c.top - 50} r="105" fill="url(#hz-crown)" />
      <rect x={CX - c.half} y={c.top - 6} width={c.half * 2} height="6" fill="#f6dca4" />
      <path d={c.d} fill="#f8e2a8" />
      <rect x={CX - 0.9} y={c.top - 215} width="1.8" height="80" fill="#e0c690" />
      <circle cx={CX} cy={c.top - 216} r="14" fill="url(#hz-beacon)" />
      <circle cx={CX} cy={c.top - 216} r="2.6" fill="#ff4a3a" />
    </svg>
  );
}
