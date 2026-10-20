"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import GlobeLoader from "@/components/globe/globe-loader";
import type {
  GlobeArc,
  GlobeLatLng,
  GlobePath,
  GlobePin,
  GlobeRing,
} from "@/components/globe/globe-types";
import { HistoryProvider, useHistory } from "@/lib/store/history-store";
import { useI18n } from "@/lib/i18n";
import type { BorderFeature, Category, HistoryEvent } from "@/lib/data/schemas";
import { fetchSnapshot } from "@/lib/data/loaders";
import { yearToSlider } from "@/lib/domain/time-scale";
import { eraForYear } from "@/lib/domain/eras";
import { visibleEvents } from "@/lib/domain/visible-events";
import { battleArcs } from "@/lib/domain/battles";
import { computeBadges } from "@/lib/domain/discovery";
import { relatedEvents } from "@/lib/domain/related";
import { storyFor } from "@/lib/domain/story";
import { featureOutlines } from "@/lib/domain/compare";
import { QUIZ_ROUNDS } from "@/lib/domain/quiz";
import { buildMyTour, MY_TOUR_ID, MY_TOUR_MAX } from "@/lib/domain/my-tour";
import {
  CATEGORY_COLORS,
  COUNTRY_PIN_COLOR,
  RING_COLOR,
  polityColor,
  polityDisplayName,
  polityKey,
} from "@/lib/domain/palette";
import { useWiki } from "./use-wiki";
import Timeline from "./timeline";
import StoryView from "./story-view";
import StoryGallery from "./story-gallery";
import SearchPalette from "./search-palette";
import HelpOverlay from "./help-overlay";

const STORY_PIN_COLOR = "#d4a73a";
const COMPARE_COLOR = "#ff2a1a"; // bright, because the globe sits under a sepia filter
type Overlay = "search" | "gallery" | "help" | null;

const CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Honors the OS "reduce motion" setting: no auto-rotation, no pulse rings, instant transitions. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export default function WorldHistoryApp() {
  return (
    <HistoryProvider>
      <Shell />
    </HistoryProvider>
  );
}

function Shell() {
  const { state, dispatch, events, eras } = useHistory();
  const { t, fy, locale, setLocale } = useI18n();
  const reducedMotion = usePrefersReducedMotion();
  const era = eraForYear(state.year, eras);
  const selectedId = state.selection?.kind === "event" ? state.selection.id : null;
  const selectedFeature = state.selection?.kind === "country" ? state.selection.feature : null;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [listOpen, setListOpen] = useState(false);
  // The list only exists in the atlas view; leaving it (story, quiz) closes it, so it does not
  // reappear and grab focus on the way back. Adjusted during render, not in an effect.
  const inAtlas = !state.story && !state.quiz;
  const [wasInAtlas, setWasInAtlas] = useState(inAtlas);
  if (wasInAtlas !== inAtlas) {
    setWasInAtlas(inAtlas);
    if (!inAtlas) setListOpen(false);
  }
  const listButton = useRef<HTMLButtonElement>(null);
  const focusListButton = useCallback(() => listButton.current?.focus(), []);
  const closeList = useCallback(() => setListOpen(false), []);
  const storyEvent = state.story ? events.find((e) => e.id === state.story?.id) : undefined;
  const story = useMemo(
    () => (storyEvent ? storyFor(storyEvent, events) : null),
    [storyEvent, events],
  );
  const quiz = state.quiz;
  const quizEvent = quiz ? events.find((e) => e.id === quiz.eventId) : undefined;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  // ⌘K / Ctrl+K / "/" search, "?" help. Everything else lives in the store's key handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOverlay((o) => (o === "search" ? null : "search"));
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        setOverlay("search");
      } else if (!typing && e.key === "?") {
        setOverlay((o) => (o === "help" ? null : "help"));
      } else if (
        inAtlas &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "l"
      ) {
        setListOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inAtlas]);

  // Compare mode: a second snapshot drawn as outlines over the current borders.
  const [compare, setCompare] = useState<{ year: number; paths: GlobePath[] } | null>(null);
  useEffect(() => {
    const y = state.compareYear;
    if (y === null) return;
    let alive = true;
    fetchSnapshot(y)
      .then(
        (features) =>
          alive && setCompare({ year: y, paths: featureOutlines(features, COMPARE_COLOR) }),
      )
      .catch(() => alive && dispatch({ type: "setCompare", year: null }));
    return () => {
      alive = false;
    };
  }, [state.compareYear, dispatch]);
  const paths = compare && compare.year === state.compareYear && !state.story ? compare.paths : [];

  const visible = useMemo(
    () =>
      // A filtered-out event opened from search or a link still gets its pin while it is selected.
      visibleEvents(events, state.year).filter(
        (e) => !state.hiddenCategories.includes(e.category) || e.id === selectedId,
      ),
    [events, state.year, state.hiddenCategories, selectedId],
  );
  const countryPins = useMemo<GlobePin[]>(
    () =>
      state.countries
        .filter((c) => c.inceptionYear === null || c.inceptionYear <= state.year)
        .map<GlobePin>((c) => ({
          id: `country:${c.iso2}`,
          kind: "country",
          lat: c.lat,
          lng: c.lng,
          color: COUNTRY_PIN_COLOR,
          radius: 0.16,
          label: `${c.name}${c.inceptionYear ? ` · ${t("since {year}", { year: fy(c.inceptionYear) })}` : ""}`,
          importance: 1,
        })),
    [state.countries, state.year, t, fy],
  );
  const pins = useMemo<GlobePin[]>(() => {
    if (quiz) {
      // Before the guess no event pin may give the answer away; afterwards show both places.
      if (!quiz.guess || !quizEvent) return countryPins;
      return [
        ...countryPins,
        {
          id: "quiz:guess",
          kind: "country",
          lat: quiz.guess.lat,
          lng: quiz.guess.lng,
          color: "#1c1913",
          radius: 0.5,
          label: t("Your guess"),
          importance: 5,
        },
        {
          id: quizEvent.id,
          kind: "event",
          lat: quizEvent.lat,
          lng: quizEvent.lng,
          color: STORY_PIN_COLOR,
          radius: 0.7,
          label: quizEvent.title,
          importance: 5,
        },
      ];
    }
    if (story && storyEvent) {
      // In a story only its own places are pinned: the event and every chapter's location.
      const chapterPins = story.chapters.map<GlobePin>((c, i) => ({
        id: `chapter:${i}`,
        kind: "event",
        lat: c.lat,
        lng: c.lng,
        color: i === state.story?.chapter ? STORY_PIN_COLOR : "#efe4cc",
        radius: i === state.story?.chapter ? 0.6 : 0.3,
        label: `${c.when} — ${t(c.heading)}`,
        importance: 5,
      }));
      return [
        {
          id: storyEvent.id,
          kind: "event",
          lat: storyEvent.lat,
          lng: storyEvent.lng,
          color: CATEGORY_COLORS[storyEvent.category],
          radius: 0.7,
          label: storyEvent.title,
          importance: 5,
        },
        ...chapterPins,
      ];
    }
    const evPins = visible.map<GlobePin>((e) => ({
      id: e.id,
      kind: "event",
      lat: e.lat,
      lng: e.lng,
      color: e.id === selectedId ? "#d4a73a" : CATEGORY_COLORS[e.category],
      radius: (e.id === selectedId ? 0.55 : 0.28) + e.importance * 0.1,
      label: `${e.title} · ${fy(e.year)}`,
      importance: e.importance,
    }));
    return [...countryPins, ...evPins];
  }, [
    quiz,
    quizEvent,
    countryPins,
    visible,
    selectedId,
    story,
    storyEvent,
    state.story?.chapter,
    t,
    fy,
  ]);
  const arcs = useMemo<GlobeArc[]>(() => {
    if (quiz) {
      return quiz.guess && quizEvent
        ? [
            {
              id: "quiz",
              startLat: quiz.guess.lat,
              startLng: quiz.guess.lng,
              endLat: quizEvent.lat,
              endLng: quizEvent.lng,
              color: ["#1c1913", STORY_PIN_COLOR],
            },
          ]
        : [];
    }
    return storyEvent ? battleArcs([storyEvent], storyEvent.year) : battleArcs(visible, state.year);
  }, [quiz, quizEvent, visible, state.year, storyEvent]);
  const chapter = story && state.story ? story.chapters[state.story.chapter] : undefined;
  const rings = useMemo<GlobeRing[]>(() => {
    // Every ring is a continuously propagating circle (ringRepeatPeriod), so reduced motion means
    // none — the static highlight survives on the pins (selected pin is gold, the chapter pin too).
    if (quiz || reducedMotion) return [];
    const pulses = state.pulses.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      color: RING_COLOR,
      maxRadius: 2 + p.importance,
    }));
    const selected = !chapter && selectedId ? events.find((e) => e.id === selectedId) : undefined;
    return [
      ...pulses,
      ...(chapter
        ? [
            {
              id: `chapter:${chapter.heading}`,
              lat: chapter.lat,
              lng: chapter.lng,
              color: STORY_PIN_COLOR,
              maxRadius: 4,
            },
          ]
        : []),
      ...(selected
        ? [
            {
              id: `sel:${selected.id}`,
              lat: selected.lat,
              lng: selected.lng,
              color: STORY_PIN_COLOR,
              maxRadius: 2.5,
            },
          ]
        : []),
    ];
  }, [quiz, state.pulses, chapter, selectedId, events, reducedMotion]);
  const polygonColor = (f: BorderFeature) =>
    f === selectedFeature ? "#d4a73a" : polityColor(polityKey(f));
  const guess = (at: GlobeLatLng) => {
    if (quiz && !quiz.guess) dispatch({ type: "quizGuess", lat: at.lat, lng: at.lng });
  };

  return (
    <div className={`stage ${state.story ? "cinematic" : ""}`}>
      <div className="globe-layer">
        <GlobeLoader
          polygons={state.polygons}
          polygonColor={polygonColor}
          pins={pins}
          arcs={arcs}
          rings={rings}
          paths={paths}
          cameraTarget={state.cameraTarget}
          autoRotate={
            !reducedMotion &&
            !state.playing &&
            !state.selection &&
            !state.tour &&
            !state.story &&
            !quiz
          }
          reducedMotion={reducedMotion}
          onPinClick={(pin) => {
            if (quiz) guess(pin);
            else if (state.story) {
              const i = pin.id.startsWith("chapter:") ? Number(pin.id.slice(8)) : 0;
              dispatch({ type: "storyGo", chapter: i });
            } else if (pin.kind === "event")
              dispatch({ type: "select", selection: { kind: "event", id: pin.id } });
            else {
              const c = state.countries.find((x) => `country:${x.iso2}` === pin.id);
              const f = state.polygons.find(
                (p) => c && (p.properties.NAME ?? "").toLowerCase() === c.name.toLowerCase(),
              );
              if (f) dispatch({ type: "select", selection: { kind: "country", feature: f } });
              else if (c)
                dispatch({
                  type: "select",
                  selection: {
                    kind: "country",
                    feature: {
                      type: "Feature",
                      properties: { NAME: c.name },
                      geometry: { type: "Polygon", coordinates: [] },
                    },
                  },
                });
            }
          }}
          onPolygonClick={(f, at) => {
            if (quiz) guess(at);
            else if (!state.story)
              dispatch({ type: "select", selection: { kind: "country", feature: f } });
          }}
          onBackgroundClick={(at) => {
            if (quiz) guess(at);
            else if (!state.story) dispatch({ type: "select", selection: null });
          }}
        />
      </div>
      {state.story ? (
        <StoryView />
      ) : (
        <>
          <header className="masthead">
            <h1>{t("World History Web")}</h1>
            <p>
              {t(
                "An atlas of everything that happened, 3000 BC to today · {events} curated events · {countries} countries",
                { events: events.length, countries: state.countries.length },
              )}
            </p>
          </header>
          <div className="year-badge">
            <YearCounter year={state.year} />
            <div className="era">
              {era ? t(era.name) : ""}
              {state.snapshotYear !== null
                ? ` · ${t("borders of {year}", { year: fy(state.snapshotYear) })}`
                : ""}
              {compare && state.compareYear !== null && (
                <span className="compare-key">
                  {" "}
                  · <i /> {fy(state.compareYear)}
                </span>
              )}
            </div>
            <div className="toolbar">
              <button
                className="btn secondary"
                onClick={() => setOverlay("search")}
                title={t("Search (⌘K or /)")}
              >
                ⌕ {t("Search")}
              </button>
              <button
                className="btn secondary gold"
                onClick={() => setOverlay("gallery")}
                title={t("Immersive stories")}
              >
                ✦ {t("Stories")}
              </button>
              <button
                ref={listButton}
                className={`btn secondary ${listOpen ? "active" : ""}`}
                onClick={() => setListOpen((o) => !o)}
                aria-expanded={listOpen}
                title={t("Events in view as a list (L)")}
              >
                ☰ {t("List")}
              </button>
              <button
                className="btn secondary"
                onClick={() => dispatch({ type: "randomEvent", seed: Math.random() * 1e9 })}
                title={t("A random event (R)")}
              >
                ⚄ {t("Surprise me")}
              </button>
              <button
                className={`btn secondary ${quiz ? "active" : ""}`}
                onClick={() =>
                  dispatch(
                    quiz ? { type: "quizEnd" } : { type: "quizStart", seed: Math.random() * 1e9 },
                  )
                }
                title={t("Where did it happen? A five-round map quiz")}
              >
                ◎ {t("Quiz")}
              </button>
              <select
                className="btn secondary"
                aria-label={t("Compare borders")}
                value={state.compareYear ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "setCompare",
                    year: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">{t("Compare borders…")}</option>
                {state.snapshotYears
                  .filter((y) => y !== state.snapshotYear)
                  .map((y) => (
                    <option key={y} value={y}>
                      {t("Outline {year}", { year: fy(y) })}
                    </option>
                  ))}
              </select>
              <button
                className="btn secondary"
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                title={t("Language")}
                lang={locale === "zh" ? "en" : "zh"}
              >
                {locale === "zh" ? "EN" : "中文"}
              </button>
              <button
                className="btn secondary"
                onClick={() => setOverlay("help")}
                title={t("Keyboard shortcuts (?)")}
                aria-label={t("Keyboard shortcuts")}
              >
                ?
              </button>
            </div>
          </div>
          {!quiz && <Badges />}
          {!quiz && <Legend count={visible.length} />}
          {!quiz && (
            <EventList
              events={visible}
              open={listOpen}
              onClose={closeList}
              returnFocus={focusListButton}
            />
          )}
          {quiz && <QuizPanel />}
          {!quiz && state.selection?.kind === "event" && <EventPanel id={state.selection.id} />}
          {!quiz && state.selection?.kind === "country" && (
            <CountryPanel feature={state.selection.feature} />
          )}
          {state.tour && <TourPlayer />}
          <Timeline onOpenGallery={() => setOverlay("gallery")} />
        </>
      )}
      <BadgeToast />
      {state.error && (
        <div className="load-error" role="alert">
          {t("Some map data failed to load.")}
          <button className="btn" onClick={() => dispatch({ type: "retry" })}>
            {t("Retry")}
          </button>
        </div>
      )}
      {overlay === "search" && <SearchPalette onClose={() => setOverlay(null)} />}
      {overlay === "gallery" && <StoryGallery onClose={() => setOverlay(null)} />}
      {overlay === "help" && <HelpOverlay onClose={() => setOverlay(null)} />}
    </div>
  );
}

/** The big year eases toward its new value instead of jumping, so scrubbing reads as travel. */
function YearCounter({ year }: { year: number }) {
  const { fy } = useI18n();
  const [shown, setShown] = useState(year);
  const shownRef = useRef(year);
  // Playback changes the year 3–12×/s, so announce only the value that settles after a pause in
  // changes — a live region fed every tick would swamp any other screen-reader feedback.
  const [settled, setSettled] = useState(year);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(year), 700);
    return () => window.clearTimeout(id);
  }, [year]);
  useEffect(() => {
    const from = shownRef.current;
    if (from === year) return;
    const start = performance.now();
    const ms = Math.min(700, 150 + Math.abs(year - from) * 2);
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      let v = Math.round(from + (year - from) * eased);
      if (v === 0) v = year > 0 ? 1 : -1;
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [year]);
  return (
    <>
      <div className="year" aria-hidden="true">
        {fy(shown)}
      </div>
      {/* The settled year only: the animated counter above must not flood a live region. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {fy(settled)}
      </span>
    </>
  );
}

/**
 * Keyboard and screen-reader route to the events the canvas pins show; the globe itself is pointer-only.
 * Always in the accessibility tree; the List button (or L) also shows it on screen.
 */
function EventList({
  events,
  open,
  onClose,
  returnFocus,
}: {
  events: HistoryEvent[];
  open: boolean;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const { state, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const shown = [...events].sort((a, b) => a.year - b.year).slice(0, 100);
  const wasOpen = useRef(open);
  useEffect(() => {
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    const q = (sel: string) => ref.current?.querySelector<HTMLButtonElement>(sel);
    // With no events in view the × is the focus target, so the list never opens unfocused.
    if (open) (q("ul button") ?? q(".events-list-head button"))?.focus();
    // However it closed (Esc, ×, L, the button), focus left inside would keep it on screen via
    // :focus-within; focus on the body means it was on the × that just unmounted.
    else if (
      closing &&
      (ref.current?.contains(document.activeElement) || document.activeElement === document.body)
    ) {
      returnFocus();
    }
  }, [open, returnFocus]);
  // Esc closes the open list wherever focus is (timeline, toolbar…), before the store's handler
  // would clear the selection instead.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  return (
    <nav
      ref={ref}
      className={`events-list ${open ? "open" : "sr-only"}`}
      aria-label={t("Events in view")}
    >
      {open && (
        <div className="events-list-head">
          <b>{t("{count} events in {year}", { count: events.length, year: fy(state.year) })}</b>
          <button className="close" onClick={onClose} aria-label={t("Close")}>
            ×
          </button>
        </div>
      )}
      <ul>
        {shown.map((e) => (
          <li key={e.id}>
            <button
              onClick={() =>
                dispatch({ type: "select", selection: { kind: "event", id: e.id }, fly: true })
              }
            >
              <i className="dot" style={{ background: CATEGORY_COLORS[e.category] }} /> {fy(e.year)}
              : {e.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Where did it happen?": click the globe, see how far off you were, five rounds. */
function QuizPanel() {
  const { state, events, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const q = state.quiz;
  const ev = q ? events.find((e) => e.id === q.eventId) : undefined;
  if (!q || !ev) return null;
  return (
    <aside className="quiz" aria-live="polite">
      <button
        className="close"
        onClick={() => dispatch({ type: "quizEnd" })}
        aria-label={t("Close")}
      >
        ×
      </button>
      <div className="meta">
        {t("Quiz · round {n} of {total}", { n: q.round, total: QUIZ_ROUNDS })} ·{" "}
        {t("score {points}", { points: q.total })}
      </div>
      {q.done ? (
        <>
          <h3>
            {t("Final score: {points} / {max}", { points: q.total, max: QUIZ_ROUNDS * 1000 })}
          </h3>
          <div className="controls">
            <button
              className="btn"
              onClick={() => dispatch({ type: "quizStart", seed: Math.random() * 1e9 })}
            >
              {t("Play again")}
            </button>
            <button className="btn secondary" onClick={() => dispatch({ type: "quizEnd" })}>
              {t("Exit")}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>{t("Where did this happen?")}</h3>
          <p className="quiz-q">
            <b>{ev.title}</b> · {fy(ev.year)}
          </p>
          {q.guess === null ? (
            <p className="credit">
              {t(
                "Click the globe where you think it happened. The borders show the world of that time.",
              )}
            </p>
          ) : (
            <>
              <p>
                {t("{km} km away · +{points} points", {
                  km: Math.round(q.km ?? 0).toLocaleString(),
                  points: q.points ?? 0,
                })}
              </p>
              <p className="credit">{ev.summary}</p>
              <div className="controls">
                <button
                  className="btn active"
                  onClick={() => dispatch({ type: "quizNext", seed: Math.random() * 1e9 })}
                >
                  {q.round >= QUIZ_ROUNDS ? t("See the score") : t("Next →")}
                </button>
                <button
                  className="btn secondary"
                  onClick={() => dispatch({ type: "openStory", id: ev.id })}
                >
                  {t("Story mode")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}

/** A short toast whenever a discovery badge unlocks. */
function BadgeToast() {
  const { state, events } = useHistory();
  const { t } = useI18n();
  const unlocked = computeBadges(state.discovery, events).filter((b) => b.unlocked);
  const seen = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const key = unlocked.map((b) => b.id).join(",");
  useEffect(() => {
    const ids = new Set(key ? key.split(",") : []);
    if (seen.current === null) {
      // Skip the first render and the restore from localStorage: only celebrate new badges.
      const t = window.setTimeout(() => (seen.current = ids), 1500);
      return () => window.clearTimeout(t);
    }
    const fresh = [...ids].find((id) => !seen.current?.has(id));
    seen.current = ids;
    if (!fresh) return;
    setToast(fresh);
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [key]);
  const badge = unlocked.find((b) => b.id === toast);
  if (!badge) return null;
  return (
    <div className="toast" role="status">
      <b>★ {t("Badge unlocked: {name}", { name: t(badge.name) })}</b>
      <span>{t(badge.description)}</span>
    </div>
  );
}

function Legend({ count }: { count: number }) {
  const { state, dispatch } = useHistory();
  const { t } = useI18n();
  return (
    <div className="legend" role="group" aria-label={t("Filter events by category")}>
      <div style={{ marginBottom: 4 }}>
        {t("{count} events in view · click to filter", { count })}
      </div>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={state.hiddenCategories.includes(c) ? "off" : ""}
          aria-pressed={!state.hiddenCategories.includes(c)}
          onClick={() => dispatch({ type: "toggleCategory", category: c })}
        >
          <i style={{ background: CATEGORY_COLORS[c] }} /> {t(c)}
        </button>
      ))}
      <div style={{ marginTop: 6, color: "#5a5142" }}>
        {t("● country pins · borders approximate")}
      </div>
    </div>
  );
}

function Badges() {
  const { state, events } = useHistory();
  const { t } = useI18n();
  const badges = computeBadges(state.discovery, events);
  return (
    <div className="badges">
      <div>
        <b>{t("Discovery")}</b> ·{" "}
        {t("{events} events · {countries} countries", {
          events: state.discovery.events.length,
          countries: state.discovery.countries.length,
        })}
      </div>
      {badges.map((b) => (
        <div key={b.id} className={`b ${b.unlocked ? "on" : ""}`} title={t(b.description)}>
          {b.unlocked ? "★" : "☆"} {t(b.name)}
        </div>
      ))}
    </div>
  );
}

function WikiBlock({ title, fallback }: { title: string; fallback?: string }) {
  const { t, locale } = useI18n();
  const data = useWiki(title, locale);
  const fb = useWiki(data && !data.ok && fallback ? fallback : null, locale);
  const d = data?.ok ? data : fb?.ok ? fb : null;
  if (!data) return <p className="credit">{t("Fetching from Wikipedia…")}</p>;
  if (!d)
    return (
      <p className="credit">
        {t("No live Wikipedia summary available ({reason}).", {
          reason: data.ok ? "" : data.reason,
        })}
      </p>
    );
  return (
    <div>
      {d.thumbnailUrl && (
        <div className="frame" style={{ height: 220 }}>
          <Image
            src={d.thumbnailUrl}
            alt={d.title}
            fill
            unoptimized
            style={{ objectFit: "cover" }}
            sizes="400px"
          />
        </div>
      )}
      <p>{d.extract}</p>
      <p className="credit">
        {t("From Wikipedia,")}{" "}
        <a href={d.pageUrl} target="_blank" rel="noreferrer">
          “{d.title}”
        </a>{" "}
        · {t("text CC BY-SA 4.0")}
      </p>
    </div>
  );
}

function EventPanel({ id }: { id: string }) {
  const { state, events, tours, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const e = events.find((x) => x.id === id);
  const related = useMemo(() => (e ? relatedEvents(e, events, tours) : []), [e, events, tours]);
  const [copied, setCopied] = useState(false);
  if (!e) return null;
  const inMyTour = state.myTour.includes(e.id);
  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };
  return (
    <aside className="panel" key={e.id} aria-label={t("Event: {title}", { title: e.title })}>
      <button
        className="close"
        onClick={() => dispatch({ type: "select", selection: null })}
        aria-label={t("Close")}
      >
        ×
      </button>
      <span className="chip" style={{ background: CATEGORY_COLORS[e.category] }}>
        {t(e.category)}
      </span>
      <div className="meta" style={{ marginTop: 8 }}>
        {fy(e.year)}
        {e.endYear ? ` – ${fy(e.endYear)}` : ""} · {t("importance {n}/5", { n: e.importance })}
      </div>
      <h2>{e.title}</h2>
      {e.story && <p className="panel-tagline">{e.story.tagline}</p>}
      <button
        className={`story-cta ${e.story ? "curated" : ""}`}
        onClick={() => dispatch({ type: "openStory", id: e.id })}
      >
        <span>▶</span>
        <span>
          <b>{e.story ? t("Enter the immersive story") : t("Open in story mode")}</b>
          <em>
            {e.story
              ? t("{n} chapters · fly through it on the globe", { n: e.story.chapters.length })
              : t("A cinematic tour of this moment")}{" "}
            · S
          </em>
        </span>
      </button>
      <p>{e.summary}</p>
      {e.videoUrl && (
        <div className="frame">
          <video controls preload="metadata" src={e.videoUrl} />
          <div className="credit" style={{ padding: "4px 6px" }}>
            {e.videoCredit ?? "Wikimedia Commons"}
          </div>
        </div>
      )}
      <WikiBlock title={e.wikipediaTitle} />
      {e.belligerents && (
        <p className="credit">
          {t("Sides:")}{" "}
          {e.belligerents
            .filter((b) => b.side === "a")
            .map((b) => b.name)
            .join(", ")}{" "}
          vs{" "}
          {e.belligerents
            .filter((b) => b.side === "b")
            .map((b) => b.name)
            .join(", ")}
        </p>
      )}
      {related.length > 0 && (
        <div className="list">
          <div className="meta" style={{ margin: "10px 0 4px" }}>
            {t("Related")}
          </div>
          {related.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                dispatch({ type: "setYear", year: r.year });
                dispatch({ type: "select", selection: { kind: "event", id: r.id }, fly: true });
              }}
            >
              <i className="dot" style={{ background: CATEGORY_COLORS[r.category] }} />{" "}
              <span className="meta">{fy(r.year)}</span> · {r.title}
              {r.story ? " ✦" : ""}
            </button>
          ))}
        </div>
      )}
      <div className="panel-nav">
        <button
          className="btn secondary"
          onClick={() => dispatch({ type: "stepEvent", delta: -1 })}
        >
          {t("← Earlier")}
        </button>
        <button className="btn secondary" onClick={share}>
          {copied ? t("Link copied ✓") : t("Copy link")}
        </button>
        <button className="btn secondary" onClick={() => dispatch({ type: "stepEvent", delta: 1 })}>
          {t("Later →")}
        </button>
      </div>
      <button
        className={`btn secondary small my-tour-toggle ${inMyTour ? "active" : ""}`}
        disabled={!inMyTour && state.myTour.length >= MY_TOUR_MAX}
        onClick={() => dispatch({ type: "toggleMyTour", id: e.id })}
      >
        {inMyTour
          ? t("✓ In my tour ({n})", { n: state.myTour.length })
          : t("+ Add to my tour ({n})", { n: state.myTour.length })}
      </button>
      <p className="credit">
        {t("Sources:")}{" "}
        {e.sources.map((s, i) => (
          <a key={s} href={s} target="_blank" rel="noreferrer">
            [{i + 1}]{" "}
          </a>
        ))}
      </p>
    </aside>
  );
}

function CountryPanel({ feature }: { feature: BorderFeature }) {
  const { state, events, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const name = (feature.properties.NAME ?? "").trim();
  const country = state.countries.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const list: HistoryEvent[] = events
    .filter((e) => country && e.countryIso === country.iso2)
    .sort((a, b) => a.year - b.year);
  const title = country ? `History of ${country.name}` : name;
  const go = (e: HistoryEvent) => {
    dispatch({ type: "setYear", year: e.year });
    dispatch({ type: "select", selection: { kind: "event", id: e.id }, fly: true });
  };
  return (
    <aside
      className="panel"
      aria-label={t("Country: {name}", { name: polityDisplayName(feature) })}
    >
      <button
        className="close"
        onClick={() => dispatch({ type: "select", selection: null })}
        aria-label={t("Close")}
      >
        ×
      </button>
      <div className="meta">{t("In {year}", { year: fy(state.year) })}</div>
      <h2>{polityDisplayName(feature)}</h2>
      {country && (
        <p className="credit">
          {country.flagUrl && (
            <Image
              src={country.flagUrl}
              alt=""
              width={28}
              height={18}
              unoptimized
              style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
            />
          )}
          {t("Today:")} <b>{country.name}</b>
          {country.capital ? ` · ${t("capital {name}", { name: country.capital })}` : ""}
          {country.inceptionYear
            ? ` · ${t("founded {year}", { year: fy(country.inceptionYear) })}`
            : ""}
          {country.population
            ? ` · ${t("{n} people", { n: country.population.toLocaleString() })}`
            : ""}
        </p>
      )}
      {list.length > 0 && (
        <div className="mini-timeline" aria-label={t("Events here over time")}>
          <span className="now" style={{ left: `${yearToSlider(state.year) * 100}%` }} />
          {list.map((e) => (
            <button
              key={e.id}
              style={{
                left: `${yearToSlider(e.year) * 100}%`,
                background: CATEGORY_COLORS[e.category],
              }}
              title={`${fy(e.year)} — ${e.title}`}
              aria-label={`${fy(e.year)}: ${e.title}`}
              onClick={() => go(e)}
            />
          ))}
        </div>
      )}
      <WikiBlock title={title} fallback={country?.name ?? name} />
      {list.length > 0 && (
        <div className="list">
          <div className="meta" style={{ margin: "8px 0 4px" }}>
            {t("Events here")}
          </div>
          {list.map((e) => (
            <button key={e.id} onClick={() => go(e)}>
              <span className="meta">{fy(e.year)}</span> · {e.title}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function TourPlayer() {
  const { state, tours, events, dispatch } = useHistory();
  const { t, fy } = useI18n();
  const mine = state.tour?.id === MY_TOUR_ID;
  const tour = mine
    ? buildMyTour(state.myTour, events)
    : tours.find((x) => x.id === state.tour?.id);
  const stop = tour?.stops[state.tour?.stop ?? 0];
  const ev = stop && events.find((e) => e.id === stop.eventId);
  if (!tour || !stop) return null;
  return (
    <section
      className="tour"
      aria-label={t("Story tour: {title}", { title: mine ? t("My tour") : tour.title })}
    >
      <div className="meta" style={{ color: "#b8892b" }}>
        {mine ? t("My tour") : tour.title} ·{" "}
        {t("stop {n} of {total}", { n: (state.tour?.stop ?? 0) + 1, total: tour.stops.length })}
      </div>
      <h3>{ev ? `${fy(ev.year)} — ${ev.title}` : stop.eventId}</h3>
      <p>{stop.narration}</p>
      <div className="controls">
        <button className="btn" onClick={() => dispatch({ type: "tourStep", delta: -1 })}>
          {t("← Back")}
        </button>
        <button className="btn" onClick={() => dispatch({ type: "tourStep", delta: 1 })}>
          {t("Next →")}
        </button>
        {ev && (
          <button className="btn" onClick={() => dispatch({ type: "openStory", id: ev.id })}>
            {ev.story ? t("✦ Immersive story") : t("Story mode")}
          </button>
        )}
        <button className="btn" onClick={() => dispatch({ type: "endTour" })}>
          {t("Exit")}
        </button>
      </div>
    </section>
  );
}
