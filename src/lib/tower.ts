/* Horizon Tower — the building's data model.
   Shared by the DOM controls (main bundle) and the 3D scene (lazy chunk), so keep it small and dependency-free. */

export const FLOORS = 72;
export const TWIST_DEG = 1.25; // rotation of each plate relative to the one below
export const FLOOR_H = 0.4; // scene units per level (1 unit = 10 m)
export const PODIUM_H = 0.8;
export const GLASS_H = FLOOR_H * 0.86;

export type BandId = "amenity" | "garden" | "sky" | "suites" | "penthouse";

export interface Amenity {
  floor: number;
  name: string;
  text: string;
}

export const AMENITIES: Amenity[] = [
  { floor: 1, name: "Arrival Lobby", text: "A triple-height hall in travertine and smoked oak, with a 24-hour concierge." },
  { floor: 2, name: "Residents' Lounge", text: "Private dining rooms, a screening room and a business salon above the lobby." },
  { floor: 22, name: "Garden Deck", text: "Shaded gardens, a children's club and a 25 m lap pool." },
  { floor: 46, name: "Wellness Level", text: "Hammam, spa suites, a strength studio and a quiet library." },
  { floor: 71, name: "Crown Pool", text: "An infinity pool turned towards the Gulf sunset." },
  { floor: 72, name: "Observatory", text: "A members' lounge at 284 m, with a telescope deck for clear winter nights." },
];

export interface Collection {
  id: BandId;
  name: string;
  from: number;
  to: number;
  blurb: string;
  sizes: string;
  price: string;
}

export const COLLECTIONS: Collection[] = [
  { id: "garden", name: "Garden Residences", from: 3, to: 21, blurb: "One and two bedrooms above the podium gardens.", sizes: "78–132 m²", price: "From AED 2.4 M" },
  { id: "sky", name: "Sky Residences", from: 23, to: 45, blurb: "Two and three bedrooms with full-height glass.", sizes: "128–196 m²", price: "From AED 4.1 M" },
  { id: "suites", name: "Horizon Suites", from: 47, to: 62, blurb: "Three bedrooms on the corner, two facades of view.", sizes: "205–260 m²", price: "From AED 7.8 M" },
  { id: "penthouse", name: "Penthouses", from: 63, to: 70, blurb: "Half-floor homes with private terraces and a plunge pool.", sizes: "410–520 m²", price: "From AED 19 M" },
];

export function amenityAt(floor: number): Amenity | undefined {
  return AMENITIES.find((a) => a.floor === floor);
}

export function bandOf(floor: number): BandId {
  if (amenityAt(floor)) return "amenity";
  if (floor <= 21) return "garden";
  if (floor <= 45) return "sky";
  if (floor <= 62) return "suites";
  return "penthouse";
}

export function bandName(floor: number): string {
  const a = amenityAt(floor);
  if (a) return a.name;
  return COLLECTIONS.find((c) => c.id === bandOf(floor))!.name;
}

/** Plate rotation of a level, in degrees (level 1 = 0°). Positive = counter-clockwise seen from above. */
export function floorRotationDeg(floor: number): number {
  return (floor - 1) * TWIST_DEG;
}

/** Half-width of a level's plate (scene units). Gentle taper with a little entasis. */
export function floorHalfSize(floor: number): number {
  const t = (floor - 1) / (FLOORS - 1);
  return 1.62 - 0.42 * Math.pow(t, 1.35) + 0.04 * Math.sin(t * Math.PI);
}

/** Height of the bottom of a level (scene units). */
export function floorBaseY(floor: number): number {
  return PODIUM_H + (floor - 1) * FLOOR_H;
}

export interface Residence {
  id: string;
  letter: string;
  type: string;
  bedrooms: string;
  area: number;
  /** centre of the residence's sector, in the plate's own frame (radians, CCW from east) */
  angle: number;
  /** half-width of the sector (radians) */
  half: number;
  bearing: number;
  compass: string;
  view: string;
  priceM: number;
  status: "Available" | "Reserved";
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const VIEWS = [
  "the creek and Old Dubai",
  "the creek and the desert edge",
  "desert sunrise",
  "Downtown at sunrise",
  "the Downtown skyline",
  "the skyline and Gulf sunsets",
  "Arabian Gulf sunsets",
  "the Gulf and the creek mouth",
];

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The residences on a level (empty on amenity levels). */
export function residencesOn(floor: number): Residence[] {
  const band = bandOf(floor);
  if (band === "amenity") return [];
  const rot = floorRotationDeg(floor);
  const t = (floor - 1) / (FLOORS - 1);

  const layouts: { letter: string; angleDeg: number; halfDeg: number; type: string; bedrooms: string; area: number }[] =
    band === "penthouse"
      ? [
          { letter: "A", angleDeg: 0, halfDeg: 90, type: "Penthouse, east wing", bedrooms: "4 bedrooms + study", area: 410 + (floor - 63) * 12 },
          { letter: "B", angleDeg: 180, halfDeg: 90, type: "Penthouse, west wing", bedrooms: "5 bedrooms", area: 452 + (floor - 63) * 9 },
        ]
      : band === "suites"
        ? [
            { letter: "A", angleDeg: 0, halfDeg: 45, type: "Horizon Suite", bedrooms: "3 bedrooms", area: 205 + (floor % 5) * 4 },
            { letter: "B", angleDeg: 90, halfDeg: 45, type: "Horizon Suite", bedrooms: "3 bedrooms + maid's room", area: 238 + (floor % 4) * 5 },
            { letter: "C", angleDeg: 180, halfDeg: 45, type: "Horizon Suite", bedrooms: "3 bedrooms + study", area: 252 + (floor % 3) * 3 },
            { letter: "D", angleDeg: 270, halfDeg: 45, type: "Horizon Suite", bedrooms: "3 bedrooms", area: 214 + (floor % 6) * 3 },
          ]
        : band === "sky"
          ? [
              { letter: "A", angleDeg: 0, halfDeg: 45, type: "Sky Residence", bedrooms: "2 bedrooms", area: 128 + (floor % 5) * 3 },
              { letter: "B", angleDeg: 90, halfDeg: 45, type: "Sky Residence", bedrooms: "3 bedrooms", area: 176 + (floor % 4) * 5 },
              { letter: "C", angleDeg: 180, halfDeg: 45, type: "Sky Residence", bedrooms: "3 bedrooms", area: 196 - (floor % 3) * 4 },
              { letter: "D", angleDeg: 270, halfDeg: 45, type: "Sky Residence", bedrooms: "2 bedrooms + study", area: 142 + (floor % 6) * 2 },
            ]
          : [
              { letter: "A", angleDeg: 0, halfDeg: 45, type: "Garden Residence", bedrooms: "1 bedroom", area: 78 + (floor % 4) * 3 },
              { letter: "B", angleDeg: 90, halfDeg: 45, type: "Garden Residence", bedrooms: "2 bedrooms", area: 118 + (floor % 5) * 2 },
              { letter: "C", angleDeg: 180, halfDeg: 45, type: "Garden Residence", bedrooms: "2 bedrooms", area: 132 - (floor % 3) * 3 },
              { letter: "D", angleDeg: 270, halfDeg: 45, type: "Garden Residence", bedrooms: "1 bedroom + study", area: 92 + (floor % 4) * 2 },
            ];

  // AED per m², rising with height and with the premium of each collection
  const rate = { garden: 30000, sky: 31500, suites: 37500, penthouse: 46000 }[band] * (1 + t * 0.35);

  return layouts.map((l, i) => {
    const worldDeg = l.angleDeg + rot; // CCW from east, in world
    const bearing = (((90 - worldDeg) % 360) + 360) % 360;
    const idx = Math.round(bearing / 45) % 8;
    return {
      id: `${floor}-${l.letter}`,
      letter: l.letter,
      type: l.type,
      bedrooms: l.bedrooms,
      area: l.area,
      angle: (l.angleDeg * Math.PI) / 180,
      half: (l.halfDeg * Math.PI) / 180,
      bearing: Math.round(bearing),
      compass: COMPASS[idx],
      view: VIEWS[idx],
      priceM: Math.round((l.area * rate) / 100000) / 10,
      status: hash(floor * 7 + i) < 0.28 ? "Reserved" : "Available",
    };
  });
}

/** A representative level for each quick-jump chip. */
export const QUICK_LEVELS: { label: string; floor: number }[] = [
  { label: "Garden", floor: 12 },
  { label: "Sky", floor: 34 },
  { label: "Suites", floor: 54 },
  { label: "Penthouse", floor: 68 },
  { label: "Crown", floor: 71 },
];
