/* Solar geometry for Lumen Quay (25.2° N) on the equinox, when the sun's declination is 0°.
   Hour is local clock time; solar noon in Dubai is close to 12:20. */

const LAT = (25.2 * Math.PI) / 180;
const SOLAR_NOON = 12.33;

export interface SunState {
  /** elevation above the horizon, degrees */
  elevation: number;
  /** compass bearing, degrees clockwise from north */
  azimuth: number;
  /** 0 at night → 1 in full day */
  day: number;
  /** 1 when the sun is low (golden / blue hour) */
  golden: number;
  /** 0 by day → 1 at full night */
  night: number;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function sunAt(hour: number, out?: SunState): SunState {
  const h = ((hour - SOLAR_NOON) * 15 * Math.PI) / 180;
  const sinEl = Math.cos(LAT) * Math.cos(h);
  const el = Math.asin(sinEl);
  const cosAz = (-Math.sin(el) * Math.sin(LAT)) / Math.max(1e-4, Math.cos(el) * Math.cos(LAT));
  let az = Math.acos(Math.min(1, Math.max(-1, cosAz)));
  if (h > 0) az = 2 * Math.PI - az;
  const elevation = (el * 180) / Math.PI;
  const s = out ?? ({} as SunState);
  s.elevation = elevation;
  s.azimuth = (az * 180) / Math.PI;
  s.day = smoothstep(-8, 6, elevation);
  s.golden = (1 - smoothstep(3, 20, elevation)) * smoothstep(-9, -1, elevation);
  s.night = 1 - smoothstep(-11, -3, elevation);
  return s;
}

export function phaseName(s: SunState): string {
  if (s.elevation < -6) return "Night";
  if (s.elevation < 0) return "Blue hour";
  if (s.elevation < 12) return "Golden hour";
  return "Day";
}

export function formatHour(hour: number): string {
  const total = Math.round(hour * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const HOUR_MIN = 5;
export const HOUR_MAX = 23;
