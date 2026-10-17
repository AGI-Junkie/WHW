"use client";

import { useMemo, useState } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { useI18n } from "@/lib/i18n";
import { buildDeepLink } from "@/lib/domain/deep-link";
import { buildMyTour, MY_TOUR_ID } from "@/lib/domain/my-tour";

/** Every event with hand-written chapters, the guided tours and the visitor's own tour, as cards. */
export default function StoryGallery({ onClose }: { onClose: () => void }) {
  const { state, events, tours, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const stories = useMemo(() => events.filter((e) => e.story).sort((a, b) => a.year - b.year), [events]);
  const mine = useMemo(() => buildMyTour(state.myTour, events), [state.myTour, events]);
  const [copied, setCopied] = useState(false);
  const copyTourLink = () => {
    const url = `${window.location.origin}${window.location.pathname}${buildDeepLink({ tour: state.myTour })}`;
    navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
  };
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="gallery" role="dialog" aria-label={t("Immersive stories")} onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label={t("Close")}>×</button>
        <h2>{t("Immersive stories")}</h2>
        <p className="credit">{t("Fly through the moments that shaped the world, chapter by chapter. Every other event can be opened in story mode too.")}</p>
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
                <span className="meta">{fy(e.year)} · {t("{n} chapters", { n: e.story!.chapters.length })}{seen ? ` · ${t("✓ seen")}` : ""}</span>
                <b>{e.title}</b>
                <span className="tag-line">{e.story!.tagline}</span>
              </button>
            );
          })}
        </div>
        <h2 style={{ marginTop: 20 }}>{t("Guided tours")}</h2>
        <div className="gallery-grid">
          {tours.map((x) => (
            <button
              key={x.id}
              className="card tour-card"
              onClick={() => {
                dispatch({ type: "startTour", id: x.id });
                onClose();
              }}
            >
              <span className="meta">{fy(x.from)} – {fy(x.to)} · {t("{n} stops", { n: x.stops.length })}{state.discovery.toursCompleted.includes(x.id) ? ` · ${t("★ done")}` : ""}</span>
              <b>{x.title}</b>
              <span className="tag-line">{x.subtitle}</span>
            </button>
          ))}
        </div>
        <h2 style={{ marginTop: 20 }}>{t("My tour")}</h2>
        {mine ? (
          <div className="my-tour">
            <p className="credit">{fy(mine.from)} – {fy(mine.to)} · {t("{n} stops", { n: mine.stops.length })}: {mine.stops.map((s) => events.find((e) => e.id === s.eventId)?.title).join(" → ")}</p>
            <div className="controls">
              <button className="btn" onClick={() => { dispatch({ type: "startTour", id: MY_TOUR_ID }); onClose(); }}>{t("▶ Start my tour")}</button>
              <button className="btn secondary" onClick={copyTourLink}>{copied ? t("Link copied ✓") : t("Copy tour link")}</button>
              <button className="btn secondary" onClick={() => dispatch({ type: "myTourLoaded", ids: [] })}>{t("Clear")}</button>
            </div>
          </div>
        ) : (
          <p className="credit">{t("Open any event and press “+ Add to my tour” to build your own journey, then share it as a link.")}</p>
        )}
      </div>
    </div>
  );
}
