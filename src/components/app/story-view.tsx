"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useHistory } from "@/lib/store/history-store";
import { CATEGORY_COLORS } from "@/lib/domain/palette";
import { chapterDurationMs, storyFor } from "@/lib/domain/story";
import { relatedEvents } from "@/lib/domain/related";
import { useI18n } from "@/lib/i18n";
import { useWiki } from "./use-wiki";

/**
 * The immersive view: letterboxed, the globe behind it flies from chapter to chapter while the
 * text, a slowly panning photograph, key facts and a quotation tell the story. Keyboard: ← → for
 * chapters, space for autoplay, Esc to leave (handled in the store).
 */
export default function StoryView() {
  const { state, events, tours, dispatch } = useHistory();
  const { t, fy, locale } = useI18n();
  const st = state.story;
  const ev = st ? events.find((e) => e.id === st.id) : undefined;
  const story = useMemo(() => (ev ? storyFor(ev, events) : null), [ev, events]);
  const related = useMemo(() => (ev ? relatedEvents(ev, events, tours, 4) : []), [ev, events, tours]);
  const wiki = useWiki(ev?.wikipediaTitle ?? null, locale);
  if (!st || !ev || !story) return null;

  const chapter = story.chapters[st.chapter]!;
  const last = st.chapter === story.chapters.length - 1;
  const color = CATEGORY_COLORS[ev.category];
  const image = wiki?.ok ? wiki.thumbnailUrl : null;

  return (
    <div className="story" role="dialog" aria-modal="false" aria-label={`${t("Story:")} ${ev.title}`}>
      <div className="story-bar top" />
      <div className="story-bar bottom" />
      <div className="story-vignette" />

      <header className="story-head">
        <div className="story-kicker">
          <span className="chip" style={{ background: color }}>{t(ev.category)}</span>
          <span>{story.curated ? t("Immersive story") : t("Story mode")}</span>
          <span>·</span>
          <span>{ev.endYear ? `${fy(ev.year)} – ${fy(ev.endYear)}` : fy(ev.year)}</span>
        </div>
        <h2>{ev.title}</h2>
        <p className="story-tagline">{story.tagline}</p>
      </header>

      <button className="story-exit" onClick={() => dispatch({ type: "closeStory" })} aria-label={t("Leave the story")}>
        {t("Esc · leave story ×")}
      </button>

      <aside className="story-side">
        <div className="story-photo">
          {image ? (
            <Image key={image} src={image} alt={ev.title} fill unoptimized sizes="360px" className="kenburns" />
          ) : (
            <div className="story-photo-empty" style={{ background: `radial-gradient(circle at 30% 30%, ${color}, #1c1913)` }}>
              <span>{fy(ev.year)}</span>
            </div>
          )}
          {wiki?.ok && (
            <a className="story-photo-credit" href={wiki.pageUrl} target="_blank" rel="noreferrer">
              {t("Image via Wikipedia,")} “{wiki.title}”
            </a>
          )}
        </div>
        <dl className="story-facts">
          {story.facts.map((f) => (
            <div key={f.label}>
              <dt>{t(f.label)}</dt>
              <dd>{t(f.value)}</dd>
            </div>
          ))}
        </dl>
        {story.quote && (
          <blockquote className="story-quote">
            <p>“{story.quote.text}”</p>
            <cite>— {story.quote.by}</cite>
          </blockquote>
        )}
      </aside>

      <section className="story-card" aria-live="polite">
        <div className="story-when" key={`w${st.chapter}`}>{chapter.when}</div>
        <div className="meta">{t("Chapter {n} of {total}", { n: st.chapter + 1, total: story.chapters.length })}</div>
        <h3 key={`h${st.chapter}`}>{t(chapter.heading)}</h3>
        <p key={`p${st.chapter}`} className="story-text">{chapter.text}</p>

        {last && (
          <div className="story-end">
            {story.legacy && <p className="story-legacy"><b>{t("Legacy.")}</b> {story.legacy}</p>}
            {related.length > 0 && (
              <>
                <div className="meta">{t("Continue the journey")}</div>
                <div className="story-next">
                  {related.map((r) => (
                    <button key={r.id} onClick={() => dispatch({ type: "openStory", id: r.id })}>
                      <i style={{ background: CATEGORY_COLORS[r.category] }} />
                      <span>{fy(r.year)}</span> {r.title}
                      {r.story && <em> · {t("story")}</em>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="story-progress">
          {story.chapters.map((c, i) => (
            <button
              key={i}
              className={i === st.chapter ? "on" : i < st.chapter ? "done" : ""}
              onClick={() => dispatch({ type: "storyGo", chapter: i })}
              title={`${c.when} — ${t(c.heading)}`}
              aria-label={t("Chapter {n}: {heading}", { n: i + 1, heading: t(c.heading) })}
            >
              {i === st.chapter && st.autoplay && (
                <span key={st.chapter} className="fill" style={{ animationDuration: `${chapterDurationMs(chapter)}ms` }} />
              )}
            </button>
          ))}
        </div>

        <div className="controls">
          <button className="btn" disabled={st.chapter === 0} onClick={() => dispatch({ type: "storyStep", delta: -1 })}>{t("← Back")}</button>
          <button className="btn" onClick={() => dispatch({ type: "storyAutoplay", autoplay: !st.autoplay })} disabled={last}>
            {st.autoplay ? t("❚❚ Pause") : t("▶ Autoplay")}
          </button>
          {last ? (
            <button className="btn active" onClick={() => dispatch({ type: "closeStory" })}>{t("Finish")}</button>
          ) : (
            <button className="btn active" onClick={() => dispatch({ type: "storyStep", delta: 1 })}>{t("Next →")}</button>
          )}
        </div>
      </section>
    </div>
  );
}
