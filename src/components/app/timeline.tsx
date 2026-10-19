"use client";

import { useMemo, useRef, useState } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { eraForYear } from "@/lib/domain/eras";
import { sliderToYear, yearToSlider } from "@/lib/domain/time-scale";
import { useI18n } from "@/lib/i18n";
import { MY_TOUR_ID } from "@/lib/domain/my-tour";

const MARKER_MIN_IMPORTANCE = 4;

/**
 * The slider, its era bands, and a row of markers for the major events: hover shows the year
 * under the cursor and the event's title, click jumps there. Gold diamonds have an immersive story;
 * the small ticks under the track are the border snapshots (the map shown is the latest one ≤ the year).
 */
export default function Timeline({ onOpenGallery }: { onOpenGallery: () => void }) {
  const { state, dispatch, eras, events, tours } = useHistory();
  const { t, fy } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; year: number } | null>(null);
  const currentEra = eraForYear(state.year, eras);
  const selectedId = state.selection?.kind === "event" ? state.selection.id : null;
  const markers = useMemo(
    () =>
      events.filter(
        (e) =>
          e.importance >= MARKER_MIN_IMPORTANCE && !state.hiddenCategories.includes(e.category),
      ),
    [events, state.hiddenCategories],
  );

  return (
    <div className="timeline">
      <div className="controls">
        <button
          className="btn"
          title={t("Previous event (←)")}
          aria-label={t("Previous event")}
          onClick={() => dispatch({ type: "stepEvent", delta: -1 })}
        >
          ⏮
        </button>
        <button
          className={`btn ${state.playing ? "active" : ""}`}
          onClick={() => dispatch({ type: "setPlaying", playing: !state.playing })}
        >
          {state.playing ? t("❚❚ Pause") : t("▶ Play")}
        </button>
        <button
          className="btn"
          title={t("Next event (→)")}
          aria-label={t("Next event")}
          onClick={() => dispatch({ type: "stepEvent", delta: 1 })}
        >
          ⏭
        </button>
        <button
          className="btn secondary"
          aria-label={t("Playback speed {n}×", { n: state.speed })}
          onClick={() =>
            dispatch({ type: "setSpeed", speed: state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1 })
          }
        >
          {state.speed}×
        </button>
        <button
          className={`btn secondary ${state.follow ? "active" : ""}`}
          aria-pressed={state.follow}
          onClick={() => dispatch({ type: "toggleFollow" })}
          title={t("Fly to the biggest event of each year while playing")}
        >
          {t("Follow")}
        </button>
        <button
          className="btn secondary gold"
          onClick={onOpenGallery}
          title={t("Immersive stories and guided tours")}
        >
          ✦ {t("Stories")}
        </button>
        <select
          className="btn secondary"
          value=""
          aria-label={t("Story tours")}
          onChange={(e) => {
            if (e.target.value) dispatch({ type: "startTour", id: e.target.value });
          }}
        >
          <option value="">{t("Tours…")}</option>
          {state.myTour.length > 0 && <option value={MY_TOUR_ID}>{t("My tour")}</option>}
          {tours.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
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
            const l = yearToSlider(e.from) * 100,
              r = yearToSlider(e.to) * 100;
            const current = e.id === currentEra?.id;
            return (
              <span
                key={e.id}
                className={current ? "current" : ""}
                style={{ left: `${l}%`, width: `${r - l}%`, background: `var(--${e.tone})` }}
                title={t(e.name)}
              >
                {r - l > 11 && <label style={{ left: "50%" }}>{t(e.name)}</label>}
              </span>
            );
          })}
        </div>
        <div className="markers">
          {markers.map((e) => (
            <button
              key={e.id}
              className={`marker ${e.story ? "story" : ""} ${e.id === selectedId ? "on" : ""}`}
              style={{
                left: `${yearToSlider(e.year) * 100}%`,
                background: e.story ? undefined : CATEGORY_COLORS[e.category],
              }}
              title={`${fy(e.year)} — ${e.title}${e.story ? ` (${t("immersive story")})` : ""}`}
              aria-label={`${fy(e.year)}: ${e.title}`}
              onClick={() => {
                dispatch({ type: "setYear", year: e.year });
                dispatch({ type: "select", selection: { kind: "event", id: e.id }, fly: true });
              }}
            />
          ))}
        </div>
        <div className="snapshots">
          {state.snapshotYears.map((y) => (
            <button
              key={y}
              className={y === state.snapshotYear ? "on" : ""}
              style={{ left: `${yearToSlider(y) * 100}%` }}
              title={t("borders of {year}", { year: fy(y) })}
              aria-label={t("borders of {year}", { year: fy(y) })}
              onClick={() => dispatch({ type: "setYear", year: y })}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(yearToSlider(state.year) * 1000)}
          onChange={(e) =>
            dispatch({ type: "setYear", year: sliderToYear(Number(e.target.value) / 1000) })
          }
          aria-label={t("Year")}
          aria-valuetext={fy(state.year)}
        />
        {hover && (
          <div className="hover-year" style={{ left: hover.x }}>
            {fy(hover.year)}
          </div>
        )}
      </div>
      <div className="readout">{fy(state.year)}</div>
    </div>
  );
}
