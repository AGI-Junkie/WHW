"use client";

import { useMemo } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { formatYear } from "@/lib/domain/time-scale";

/** Every event with hand-written chapters, plus the guided tours, as a grid of cards. */
export default function StoryGallery({ onClose }: { onClose: () => void }) {
  const { state, events, tours, dispatch } = useHistory();
  const stories = useMemo(() => events.filter((e) => e.story).sort((a, b) => a.year - b.year), [events]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="gallery" role="dialog" aria-label="Immersive stories" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Immersive stories</h2>
        <p className="credit">Fly through the moments that shaped the world, chapter by chapter. Every other event can be opened in story mode too.</p>
        <div className="gallery-grid">
          {stories.map((e) => {
            const seen = state.discovery.events.includes(e.id);
            return (
              <button
                key={e.id}
                className="card"
                style={{ borderTopColor: CATEGORY_COLORS[e.category] }}
                onClick={() => {
                  dispatch({ type: "openStory", id: e.id });
                  onClose();
                }}
              >
                <span className="meta">{formatYear(e.year)} · {e.story!.chapters.length} chapters{seen ? " · ✓ seen" : ""}</span>
                <b>{e.title}</b>
                <span className="tag-line">{e.story!.tagline}</span>
              </button>
            );
          })}
        </div>
        <h2 style={{ marginTop: 20 }}>Guided tours</h2>
        <div className="gallery-grid">
          {tours.map((t) => (
            <button
              key={t.id}
              className="card tour-card"
              onClick={() => {
                dispatch({ type: "startTour", id: t.id });
                onClose();
              }}
            >
              <span className="meta">{formatYear(t.from)} – {formatYear(t.to)} · {t.stops.length} stops{state.discovery.toursCompleted.includes(t.id) ? " · ★ done" : ""}</span>
              <b>{t.title}</b>
              <span className="tag-line">{t.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
