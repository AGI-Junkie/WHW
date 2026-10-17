"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { search, type SearchResult } from "@/lib/domain/search";
import { useI18n } from "@/lib/i18n";

/** ⌘K / Ctrl+K / "/" palette: events, countries, or a year to jump to. */
export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const { state, events, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(query, events, state.countries), [query, events, state.countries]);

  useEffect(() => input.current?.focus(), []);

  const choose = (r: SearchResult | undefined, story = false) => {
    if (!r) return;
    if (r.kind === "year") dispatch({ type: "setYear", year: r.year });
    else if (r.kind === "event") {
      if (story) dispatch({ type: "openStory", id: r.event.id });
      else {
        dispatch({ type: "setYear", year: r.event.year });
        dispatch({ type: "select", selection: { kind: "event", id: r.event.id }, fly: true });
      }
    } else {
      const c = r.country;
      const f = state.polygons.find((p) => (p.properties.NAME ?? "").toLowerCase() === c.name.toLowerCase());
      dispatch({
        type: "select",
        selection: { kind: "country", feature: f ?? { type: "Feature", properties: { NAME: c.name }, geometry: { type: "Polygon", coordinates: [] } } },
      });
      dispatch({ type: "flyTo", target: { lat: c.lat, lng: c.lng, altitude: 1.4 } });
    }
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label={t("Search history")} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={query}
          placeholder={t("Search events, countries, or a year like 1453 or 500 BC…")}
          aria-label={t("Search")}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") choose(results[active], e.shiftKey);
          }}
        />
        <ul>
          {results.map((r, i) => (
            <li key={r.kind === "event" ? r.event.id : r.kind === "country" ? r.country.iso2 : "year"}>
              <button className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => choose(r)}>
                {r.kind === "year" && <><span className="tag">{t("Year")}</span> {t("Jump to {year}", { year: fy(r.year) })}</>}
                {r.kind === "country" && <><span className="tag">{t("Country")}</span> {r.country.name}{r.country.capital ? <em> · {r.country.capital}</em> : null}</>}
                {r.kind === "event" && (
                  <>
                    <i style={{ background: CATEGORY_COLORS[r.event.category] }} />
                    <span className="tag">{fy(r.event.year)}</span> {r.event.title}
                    {r.event.story && <em className="gold"> · {t("immersive story")}</em>}
                  </>
                )}
              </button>
            </li>
          ))}
          {query && results.length === 0 && <li className="empty">{t("Nothing found for “{query}”.", { query })}</li>}
        </ul>
        <div className="palette-foot">{t("↑↓ choose · Enter open · Shift+Enter open as story · Esc close")}</div>
      </div>
    </div>
  );
}
