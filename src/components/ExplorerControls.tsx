"use client";

import { useEffect, useMemo } from "react";
import { explorer, useExplorerValue } from "@/lib/store";
import { useReducedMotion } from "@/lib/motion";
import { FLOORS, QUICK_LEVELS, amenityAt, bandName, residencesOn } from "@/lib/tower";
import { HOUR_MAX, HOUR_MIN, formatHour, phaseName, sunAt } from "@/lib/sun";

function setFloor(floor: number) {
  const f = Math.min(FLOORS, Math.max(1, Math.round(floor)));
  const { unit } = explorer.get();
  const count = residencesOn(f).length;
  explorer.set({ floor: f, unit: count === 0 ? -1 : Math.min(Math.max(unit, 0), count - 1) });
}

const PRESETS = [
  { label: "Day", hour: 12.5 },
  { label: "Golden hour", hour: 17.75 },
  { label: "Night", hour: 21.5 },
];

/** Quantised to the slider's 5-minute step: while "Play a day" runs, the readout re-renders ~13 times a second, not 60. */
const selectHour5 = (s: { hour: number }) => Math.round(s.hour * 12) / 12;
const selectFloor = (s: { floor: number }) => s.floor;
const selectUnit = (s: { unit: number }) => s.unit;
const selectPlaying = (s: { playing: boolean }) => s.playing;

export function ExplorerControls() {
  const playing = useExplorerValue(selectPlaying);
  const reduced = useReducedMotion();

  // "Play a day": advances the clock while the stage is on screen and the tab is visible.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const stage = document.getElementById("stage");
    const io = stage
      ? new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
        })
      : null;
    if (stage) io?.observe(stage);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        let h = explorer.get().hour + dt * 1.1;
        if (h > HOUR_MAX) h = HOUR_MIN;
        explorer.set({ hour: h });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [playing]);

  useEffect(() => {
    if (reduced && explorer.get().playing) explorer.set({ playing: false });
  }, [reduced]);

  return (
    <div className="controls">
      <LevelControls />
      <ResidenceControls />
      <TimeControls reduced={reduced} />
    </div>
  );
}

function LevelControls() {
  const floor = useExplorerValue(selectFloor);
  return (
    <fieldset className="ctl">
      <legend className="ctl-legend">Level</legend>
      <div className="level-row">
        <button type="button" className="btn-icon" onClick={() => setFloor(floor - 1)} disabled={floor <= 1} aria-label="One level down">
          <span aria-hidden="true">−</span>
        </button>
        <p className="level-readout" aria-live="polite">
          <span className="level-num">{String(floor).padStart(2, "0")}</span>
          <span className="level-band">{bandName(floor)}</span>
        </p>
        <button type="button" className="btn-icon" onClick={() => setFloor(floor + 1)} disabled={floor >= FLOORS} aria-label="One level up">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <label htmlFor="level-range" className="sr-only">
        Choose a level from 1 to {FLOORS}
      </label>
      <input
        id="level-range"
        className="range"
        type="range"
        min={1}
        max={FLOORS}
        step={1}
        value={floor}
        onChange={(e) => setFloor(Number(e.target.value))}
        aria-valuetext={`Level ${floor}, ${bandName(floor)}`}
      />
      <div className="chips" role="group" aria-label="Jump to a collection">
        {QUICK_LEVELS.map((q) => (
          <button key={q.label} type="button" className="chip" aria-pressed={floor === q.floor} onClick={() => setFloor(q.floor)}>
            {q.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ResidenceControls() {
  const floor = useExplorerValue(selectFloor);
  const unit = useExplorerValue(selectUnit);
  const units = useMemo(() => residencesOn(floor), [floor]);
  const amenity = amenityAt(floor);
  const selected = units[unit];
  return (
    <fieldset className="ctl">
      <legend className="ctl-legend">{amenity ? "Shared level" : "Residences on this level"}</legend>
      {amenity ? (
        <div className="detail">
          <p className="detail-title">
            L{amenity.floor} · {amenity.name}
          </p>
          <p className="detail-text">{amenity.text}</p>
          <p className="detail-meta">Residents only · open 06:00 – 23:00</p>
        </div>
      ) : (
        <>
          <div className={`units units--${units.length}`}>
            {units.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className="unit"
                aria-pressed={i === unit}
                onClick={() => explorer.set({ unit: i })}
              >
                <span className="unit-letter">{r.letter}</span>
                <span className="unit-meta">
                  {r.area} m² · {r.compass}
                </span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="detail" aria-live="polite">
              <p className="detail-title">
                Residence {selected.id}
                <span className={`status status--${selected.status.toLowerCase()}`}>{selected.status}</span>
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Type</dt>
                  <dd>{selected.type}</dd>
                </div>
                <div>
                  <dt>Layout</dt>
                  <dd>{selected.bedrooms}</dd>
                </div>
                <div>
                  <dt>Interior</dt>
                  <dd>{selected.area} m²</dd>
                </div>
                <div>
                  <dt>Indicative</dt>
                  <dd>AED {selected.priceM.toFixed(1)} M</dd>
                </div>
              </dl>
              <p className="detail-text">
                Faces {selected.bearing}° {selected.compass} — {selected.view}.
              </p>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

function TimeControls({ reduced }: { reduced: boolean }) {
  const hour = useExplorerValue(selectHour5);
  const playing = useExplorerValue(selectPlaying);
  const sun = sunAt(hour);
  return (
    <fieldset className="ctl">
      <legend className="ctl-legend">Time of day</legend>
      <p className="time-readout" aria-live={playing ? "off" : "polite"}>
        <span className="time-clock">{formatHour(hour)}</span>
        <span className="time-phase">
          {phaseName(sun)}
          {sun.elevation > 0 ? ` · sun ${Math.round(sun.elevation)}° high, bearing ${Math.round(sun.azimuth)}°` : " · city lights on"}
        </span>
      </p>
      <label htmlFor="time-range" className="sr-only">
        Time of day, equinox sun path
      </label>
      <input
        id="time-range"
        className="range range--sun"
        type="range"
        min={HOUR_MIN * 60}
        max={HOUR_MAX * 60}
        step={5}
        value={Math.round(hour * 60)}
        onChange={(e) => explorer.set({ hour: Number(e.target.value) / 60, playing: false })}
        aria-valuetext={`${formatHour(hour)}, ${phaseName(sun)}`}
      />
      <div className="chips" role="group" aria-label="Light presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            aria-pressed={!playing && Math.abs(hour - p.hour) < 0.01}
            onClick={() => explorer.set({ hour: p.hour, playing: false })}
          >
            {p.label}
          </button>
        ))}
        {/* always rendered (no layout shift); CSS hides it unless full motion is on */}
        <button
          type="button"
          className="chip chip--play"
          aria-pressed={playing}
          onClick={() => {
            if (!reduced) explorer.set({ playing: !playing });
          }}
        >
          {playing ? "Pause" : "Play a day"}
        </button>
      </div>
      <p className="ctl-note">Equinox sun path at 25.2° N, the latitude of Dubai.</p>
    </fieldset>
  );
}
