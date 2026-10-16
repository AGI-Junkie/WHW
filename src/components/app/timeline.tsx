"use client";

import { useMemo, useRef, useState } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { formatYear, sliderToYear, yearToSlider } from "@/lib/domain/time-scale";

const MARKER_MIN_IMPORTANCE = 4;

/**
 * The slider, its era bands, and a row of markers for the major events: hover shows the year
 * under the cursor and the event's title, click jumps there. Gold diamonds have an immersive story.
 */
export default function Timeline({ onOpenGallery }: { onOpenGallery: () => void }) {
  const { state, dispatch, eras, events, tours } = useHistory();
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; year: number } | null>(null);
  const selectedId = state.selection?.kind === "event" ? state.selection.id : null;
  const markers = useMemo(
    () => events.filter((e) => e.importance >= MARKER_MIN_IMPORTANCE && !state.hiddenCategories.includes(e.category)),
    [events, state.hiddenCategories],
  );

  return (
    <div className="timeline">
      <div className="controls">
        <button className="btn" title="Previous event (←)" aria-label="Previous event" onClick={() => dispatch({ type: "stepEvent", delta: -1 })}>⏮</button>
        <button className={`btn ${state.playing ? "active" : ""}`} onClick={() => dispatch({ type: "setPlaying", playing: !state.playing })}>
          {state.playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button className="btn" title="Next event (→)" aria-label="Next event" onClick={() => dispatch({ type: "stepEvent", delta: 1 })}>⏭</button>
        <button className="btn secondary" onClick={() => dispatch({ type: "setSpeed", speed: state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1 })}>
          {state.speed}×
        </button>
        <button className={`btn secondary ${state.follow ? "active" : ""}`} onClick={() => dispatch({ type: "toggleFollow" })} title="Fly to the biggest event of each year while playing">
          Follow
        </button>
        <button className="btn secondary gold" onClick={onOpenGallery} title="Immersive stories and guided tours">
          ✦ Stories
        </button>
        <select className="btn secondary" value="" aria-label="Story tours" onChange={(e) => {
            if (e.target.value) dispatch({ type: "startTour", id: e.target.value });
          }}>
          <option value="">Tours…</option>
          {tours.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>
      <div
        className="track"
        ref={track}
        onMouseMove={(e) => {
          const r = track.current?.getBoundingClientRect();
          if (!r) return;
          const x = Math.min(Math.max(0, e.clientX - r.left), r.width);
          setHover({ x, year: sliderToYear(x / r.width) });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="eras">
          {eras.map((e) => {
            const l = yearToSlider(e.from) * 100, r = yearToSlider(e.to) * 100;
            const current = state.year >= e.from && state.year < e.to;
            return (
              <span key={e.id} className={current ? "current" : ""} style={{ left: `${l}%`, width: `${r - l}%`, background: `var(--${e.tone})` }} title={e.name}>
                {r - l > 11 && <label style={{ left: "50%" }}>{e.name}</label>}
              </span>
            );
          })}
        </div>
        <div className="markers">
          {markers.map((e) => (
            <button
              key={e.id}
              className={`marker ${e.story ? "story" : ""} ${e.id === selectedId ? "on" : ""}`}
              style={{ left: `${yearToSlider(e.year) * 100}%`, background: e.story ? undefined : CATEGORY_COLORS[e.category] }}
              title={`${formatYear(e.year)} — ${e.title}${e.story ? " (immersive story)" : ""}`}
              aria-label={`${formatYear(e.year)}: ${e.title}`}
              onClick={() => {
                dispatch({ type: "setYear", year: e.year });
                dispatch({ type: "select", selection: { kind: "event", id: e.id }, fly: true });
              }}
            />
          ))}
        </div>
        <input type="range" min={0} max={1000} step={1} value={Math.round(yearToSlider(state.year) * 1000)}
          onChange={(e) => dispatch({ type: "setYear", year: sliderToYear(Number(e.target.value) / 1000) })} aria-label="Year" />
        {hover && <div className="hover-year" style={{ left: hover.x }}>{formatYear(hover.year)}</div>}
      </div>
      <div className="readout">{formatYear(state.year)}</div>
    </div>
  );
}
