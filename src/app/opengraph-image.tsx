import { ImageResponse } from "next/og";

export const alt = "Horizon Tower — Seventy-two levels. One turning horizon.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FLOORS = 48;

export default function OpengraphImage() {
  const bands = Array.from({ length: FLOORS }, (_, i) => {
    const f = FLOORS - i; // top first
    const t = f / FLOORS;
    const th = (t * 90 + 20) * (Math.PI / 180);
    const half = (150 - 40 * Math.pow(t, 1.3)) * (1 + 0.2 * Math.abs(Math.sin(2 * th)));
    const split = 0.5 + Math.sin(2 * th - 0.6) * 0.22;
    return { w: Math.round(half * 2), split, sel: f === 32 };
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(180deg, #141a36 0%, #3a4672 48%, #c9775a 82%, #f29a55 100%)",
          fontFamily: "serif",
          color: "#F6F0E6",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 700 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#E2AE5E", fontFamily: "sans-serif", textTransform: "uppercase" }}>
            Lumen Quay · Dubai
          </div>
          <div style={{ fontSize: 96, lineHeight: 1.0, marginTop: 24 }}>Horizon Tower</div>
          <div style={{ fontSize: 40, lineHeight: 1.2, marginTop: 24, fontStyle: "italic", color: "#F6F0E6" }}>
            Seventy-two levels. One turning horizon.
          </div>
          <div style={{ fontSize: 22, marginTop: 40, fontFamily: "sans-serif", color: "#EFE6D8" }}>
            Explore in real-time 3D · Concept project — fictional brand.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1, paddingBottom: 40 }}>
          <div style={{ width: 4, height: 50, background: "#d2bb8c" }} />
          {bands.map((b, i) => (
            <div key={i} style={{ display: "flex", width: b.w, height: 9, marginTop: 1.5 }}>
              <div style={{ width: `${b.split * 100}%`, height: "100%", background: b.sel ? "#f1bd6b" : "#e4a868" }} />
              <div style={{ flex: 1, height: "100%", background: b.sel ? "#5cc2be" : "#2a3048" }} />
            </div>
          ))}
          <div style={{ width: 420, height: 26, background: "#4a4250", marginTop: 2 }} />
        </div>
      </div>
    ),
    size
  );
}
