"use client";

import { useHistory } from "@/lib/store/history-store";
import { useI18n } from "@/lib/i18n";
import { worldAtYear } from "@/lib/domain/world-at-year";
import { sliderToYear, yearToSlider } from "@/lib/domain/time-scale";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { useOverlayKeys } from "./use-overlay-keys";

export default function WorldOverview({ onClose }: { onClose: () => void }) {
  const { state, events, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const dialog = useOverlayKeys(onClose);
  const { from, to, groups } = worldAtYear(
    events.filter((e) => !state.hiddenCategories.includes(e.category)),
    state.year,
  );
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        {...dialog}
        className="gallery world-overview"
        role="dialog"
        aria-labelledby="world-overview-title"
        aria-describedby="world-overview-description"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label={t("Close")}>
          ×
        </button>
        <h2 id="world-overview-title">{t("Meanwhile, around the world")}</h2>
        <p id="world-overview-description" className="credit">
          {t("Explore nearby and ongoing events by location. Each card shows its actual dates.")}
        </p>
        <label className="world-year">
          {t("Explore year")}: <b>{fy(state.year)}</b>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(yearToSlider(state.year) * 1000)}
            aria-label={t("Explore year")}
            aria-valuetext={fy(state.year)}
            onChange={(e) =>
              dispatch({ type: "setYear", year: sliderToYear(Number(e.target.value) / 1000) })
            }
          />
        </label>
        <p className="credit">
          {t("Time window: {from} – {to}", { from: fy(from), to: fy(to) })}
          {" · "}
          {t("Up to three events per region, using your category filters.")}
        </p>
        <div className="gallery-grid world-regions">
          {groups.map(({ region, events: nearby }) => (
            <section key={region} aria-label={t(region)}>
              <h3>{t(region)}</h3>
              {nearby.length ? (
                nearby.map((e) => (
                  <button
                    key={e.id}
                    className="card"
                    style={{ borderTopColor: CATEGORY_COLORS[e.category] }}
                    onClick={() => {
                      dispatch({ type: "openEvent", id: e.id });
                      onClose();
                    }}
                  >
                    <span className="meta">
                      {fy(e.year)}
                      {e.endYear !== undefined ? ` – ${fy(e.endYear)}` : ""} · {t(e.category)}
                    </span>
                    <b>{e.title}</b>
                    <span className="tag-line">{e.summary}</span>
                  </button>
                ))
              ) : (
                <p className="credit">{t("No curated events in this time window.")}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
