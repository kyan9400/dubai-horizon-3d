/* Schematic, code-made map of the fictional Lumen Quay district. Not to scale. */

const PLACES = [
  { x: 470, y: 120, label: "Business district", anchor: "start" as const },
  { x: 560, y: 300, label: "Downtown", anchor: "start" as const },
  { x: 610, y: 470, label: "Airport", anchor: "end" as const },
  { x: 120, y: 470, label: "Marina & beaches", anchor: "start" as const },
  { x: 655, y: 70, label: "Desert reserve", anchor: "end" as const },
];

export function LocationMap() {
  return (
    <svg className="map" viewBox="0 0 700 540" role="img" aria-labelledby="map-title map-desc">
      <title id="map-title">Schematic map of Lumen Quay</title>
      <desc id="map-desc">
        Horizon Tower sits on a bend of the creek. Main roads lead north to the business district and Downtown, east to the
        airport and west along the coast to the marina.
      </desc>
      <rect width="700" height="540" fill="#11141B" />
      {/* Gulf */}
      <path d="M0 400 C120 380 180 420 260 440 C330 458 360 520 380 540 L0 540 Z" fill="#14303a" />
      {/* creek */}
      <path
        d="M330 540 C320 470 300 420 320 360 C340 300 400 280 420 230 C440 180 420 120 470 80 C510 50 560 40 700 30"
        fill="none"
        stroke="#1c4250"
        strokeWidth="34"
        strokeLinecap="round"
      />
      {/* grid */}
      <g stroke="#1f2430" strokeWidth="1">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={i * 56} y1="0" x2={i * 56} y2="540" />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 60} x2="700" y2={i * 60} />
        ))}
      </g>
      {/* roads */}
      <g fill="none" stroke="#5a5446" strokeWidth="5" strokeLinecap="round">
        <path d="M60 520 C200 430 300 360 380 300 C470 240 560 170 690 120" />
        <path d="M360 330 C430 330 520 360 690 470" />
        <path d="M380 300 C420 230 450 170 470 0" />
      </g>
      <g fill="none" stroke="#2a303d" strokeWidth="2" strokeDasharray="6 8">
        <circle cx="360" cy="320" r="90" />
        <circle cx="360" cy="320" r="180" />
      </g>
      <text x="452" y="318" fill="#8f8a80" fontSize="13" fontFamily="var(--font-manrope), sans-serif">
        10 min
      </text>
      <text x="540" y="318" fill="#8f8a80" fontSize="13" fontFamily="var(--font-manrope), sans-serif">
        20 min
      </text>
      {/* places */}
      {PLACES.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="6" fill="#CDBFAA" />
          <text
            x={p.anchor === "start" ? p.x + 12 : p.x - 12}
            y={p.y + 5}
            textAnchor={p.anchor}
            fill="#F6F0E6"
            fontSize="17"
            fontFamily="var(--font-manrope), sans-serif"
          >
            {p.label}
          </text>
        </g>
      ))}
      {/* the tower */}
      <circle cx="360" cy="320" r="26" fill="none" stroke="#E2AE5E" strokeWidth="2" />
      <circle cx="360" cy="320" r="9" fill="#E2AE5E" />
      <text x="360" y="372" textAnchor="middle" fill="#E2AE5E" fontSize="18" fontWeight="700" fontFamily="var(--font-manrope), sans-serif">
        Horizon Tower
      </text>
      <text x="40" y="44" fill="#CDBFAA" fontSize="14" letterSpacing="3" fontFamily="var(--font-manrope), sans-serif">
        N ↑ · SCHEMATIC, NOT TO SCALE
      </text>
    </svg>
  );
}
