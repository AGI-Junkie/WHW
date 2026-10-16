"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import GlobeLoader from "@/components/globe/globe-loader";
import type { GlobeArc, GlobePin, GlobeRing } from "@/components/globe/globe-types";
import { HistoryProvider, useHistory } from "@/lib/store/history-store";
import type { BorderFeature, Category, HistoryEvent } from "@/lib/data/schemas";
import { formatYear } from "@/lib/domain/time-scale";
import { eraForYear } from "@/lib/domain/eras";
import { visibleEvents } from "@/lib/domain/visible-events";
import { battleArcs } from "@/lib/domain/battles";
import { computeBadges } from "@/lib/domain/discovery";
import { relatedEvents } from "@/lib/domain/related";
import { storyFor } from "@/lib/domain/story";
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
type Overlay = "search" | "gallery" | "help" | null;

const CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[];

export default function WorldHistoryApp() {
  return (
    <HistoryProvider>
      <Shell />
    </HistoryProvider>
  );
}

function Shell() {
  const { state, dispatch, events, eras } = useHistory();
  const era = eraForYear(state.year, eras);
  const selectedId = state.selection?.kind === "event" ? state.selection.id : null;
  const selectedFeature = state.selection?.kind === "country" ? state.selection.feature : null;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const storyEvent = state.story ? events.find((e) => e.id === state.story?.id) : undefined;
  const story = useMemo(() => (storyEvent ? storyFor(storyEvent, events) : null), [storyEvent, events]);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () => visibleEvents(events, state.year).filter((e) => !state.hiddenCategories.includes(e.category)),
    [events, state.year, state.hiddenCategories],
  );
  const pins = useMemo<GlobePin[]>(() => {
    if (story && storyEvent) {
      // In a story only its own places are pinned: the event and every chapter's location.
      const chapterPins = story.chapters.map<GlobePin>((c, i) => ({
        id: `chapter:${i}`, kind: "event", lat: c.lat, lng: c.lng,
        color: i === state.story?.chapter ? STORY_PIN_COLOR : "#efe4cc",
        radius: i === state.story?.chapter ? 0.6 : 0.3, label: `${c.when} — ${c.heading}`, importance: 5,
      }));
      return [
        { id: storyEvent.id, kind: "event", lat: storyEvent.lat, lng: storyEvent.lng, color: CATEGORY_COLORS[storyEvent.category], radius: 0.7, label: storyEvent.title, importance: 5 },
        ...chapterPins,
      ];
    }
    const evPins = visible.map<GlobePin>((e) => ({
      id: e.id, kind: "event", lat: e.lat, lng: e.lng,
      color: e.id === selectedId ? "#d4a73a" : CATEGORY_COLORS[e.category],
      radius: (e.id === selectedId ? 0.55 : 0.28) + e.importance * 0.1,
      label: `${e.title} · ${formatYear(e.year)}`, importance: e.importance,
    }));
    const cPins = state.countries
      .filter((c) => c.inceptionYear === null || c.inceptionYear <= state.year)
      .map<GlobePin>((c) => ({
        id: `country:${c.iso2}`, kind: "country", lat: c.lat, lng: c.lng, color: COUNTRY_PIN_COLOR,
        radius: 0.16, label: `${c.name}${c.inceptionYear ? ` · since ${formatYear(c.inceptionYear)}` : ""}`, importance: 1,
      }));
    return [...cPins, ...evPins];
  }, [visible, state.countries, state.year, selectedId, story, storyEvent, state.story?.chapter]);
  const arcs = useMemo<GlobeArc[]>(
    () => (storyEvent ? battleArcs([storyEvent], storyEvent.year) : battleArcs(visible, state.year)),
    [visible, state.year, storyEvent],
  );
  const chapter = story && state.story ? story.chapters[state.story.chapter] : undefined;
  const rings = useMemo<GlobeRing[]>(() => {
    const pulses = state.pulses.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: RING_COLOR, maxRadius: 2 + p.importance }));
    const selected = !chapter && selectedId ? events.find((e) => e.id === selectedId) : undefined;
    return [
      ...pulses,
      ...(chapter ? [{ id: `chapter:${chapter.heading}`, lat: chapter.lat, lng: chapter.lng, color: STORY_PIN_COLOR, maxRadius: 4 }] : []),
      ...(selected ? [{ id: `sel:${selected.id}`, lat: selected.lat, lng: selected.lng, color: STORY_PIN_COLOR, maxRadius: 2.5 }] : []),
    ];
  }, [state.pulses, chapter, selectedId, events]);
  const polygonColor = (f: BorderFeature) => (f === selectedFeature ? "#d4a73a" : polityColor(polityKey(f)));

  return (
    <div className={`stage ${state.story ? "cinematic" : ""}`}>
      <div className="globe-layer">
        <GlobeLoader
          polygons={state.polygons}
          polygonColor={polygonColor}
          pins={pins}
          arcs={arcs}
          rings={rings}
          cameraTarget={state.cameraTarget}
          autoRotate={!state.playing && !state.selection && !state.tour && !state.story}
          onPinClick={(pin) => {
            if (state.story) {
              const i = pin.id.startsWith("chapter:") ? Number(pin.id.slice(8)) : 0;
              dispatch({ type: "storyGo", chapter: i });
            } else if (pin.kind === "event") dispatch({ type: "select", selection: { kind: "event", id: pin.id } });
            else {
              const c = state.countries.find((x) => `country:${x.iso2}` === pin.id);
              const f = state.polygons.find((p) => c && (p.properties.NAME ?? "").toLowerCase() === c.name.toLowerCase());
              if (f) dispatch({ type: "select", selection: { kind: "country", feature: f } });
              else if (c) dispatch({ type: "select", selection: { kind: "country", feature: { type: "Feature", properties: { NAME: c.name }, geometry: { type: "Polygon", coordinates: [] } } } });
            }
          }}
          onPolygonClick={(f) => {
            if (!state.story) dispatch({ type: "select", selection: { kind: "country", feature: f } });
          }}
          onBackgroundClick={() => {
            if (!state.story) dispatch({ type: "select", selection: null });
          }}
        />
      </div>
      {state.story ? (
        <StoryView />
      ) : (
        <>
          <header className="masthead">
            <h1>World History Web</h1>
            <p>An atlas of everything that happened, 3000 BC to today · {events.length} curated events · {state.countries.length} countries</p>
          </header>
          <div className="year-badge">
            <YearCounter year={state.year} />
            <div className="era">{era?.name ?? ""}{state.snapshotYear !== null ? ` · borders of ${formatYear(state.snapshotYear)}` : ""}</div>
            <div className="toolbar">
              <button className="btn secondary" onClick={() => setOverlay("search")} title="Search (⌘K or /)">⌕ Search</button>
              <button className="btn secondary gold" onClick={() => setOverlay("gallery")} title="Immersive stories">✦ Stories</button>
              <button className="btn secondary" onClick={() => dispatch({ type: "randomEvent", seed: Math.random() * 1e9 })} title="A random event (R)">⚄ Surprise me</button>
              <button className="btn secondary" onClick={() => setOverlay("help")} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">?</button>
            </div>
          </div>
          <Badges />
          <Legend count={visible.length} />
          {state.selection?.kind === "event" && <EventPanel id={state.selection.id} />}
          {state.selection?.kind === "country" && <CountryPanel feature={state.selection.feature} />}
          {state.tour && <TourPlayer />}
          <Timeline onOpenGallery={() => setOverlay("gallery")} />
        </>
      )}
      <BadgeToast />
      {overlay === "search" && <SearchPalette onClose={() => setOverlay(null)} />}
      {overlay === "gallery" && <StoryGallery onClose={() => setOverlay(null)} />}
      {overlay === "help" && <HelpOverlay onClose={() => setOverlay(null)} />}
    </div>
  );
}

/** The big year eases toward its new value instead of jumping, so scrubbing reads as travel. */
function YearCounter({ year }: { year: number }) {
  const [shown, setShown] = useState(year);
  const shownRef = useRef(year);
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
  return <div className="year">{formatYear(shown)}</div>;
}

/** A short toast whenever a discovery badge unlocks. */
function BadgeToast() {
  const { state, events } = useHistory();
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
      <b>★ Badge unlocked: {badge.name}</b>
      <span>{badge.description}</span>
    </div>
  );
}

function Legend({ count }: { count: number }) {
  const { state, dispatch } = useHistory();
  return (
    <div className="legend">
      <div style={{ marginBottom: 4 }}><b>{count}</b> events in view · click to filter</div>
      {CATEGORIES.map((c) => (
        <button key={c} className={state.hiddenCategories.includes(c) ? "off" : ""} onClick={() => dispatch({ type: "toggleCategory", category: c })}>
          <i style={{ background: CATEGORY_COLORS[c] }} /> {c}
        </button>
      ))}
      <div style={{ marginTop: 6, color: "#5a5142" }}>● country pins · borders approximate</div>
    </div>
  );
}

function Badges() {
  const { state, events } = useHistory();
  const badges = computeBadges(state.discovery, events);
  return (
    <div className="badges">
      <div><b>Discovery</b> · {state.discovery.events.length} events · {state.discovery.countries.length} countries</div>
      {badges.map((b) => <div key={b.id} className={`b ${b.unlocked ? "on" : ""}`} title={b.description}>{b.unlocked ? "★" : "☆"} {b.name}</div>)}
    </div>
  );
}

function WikiBlock({ title, fallback }: { title: string; fallback?: string }) {
  const data = useWiki(title);
  const fb = useWiki(data && !data.ok && fallback ? fallback : null);
  const d = data?.ok ? data : fb?.ok ? fb : null;
  if (!data) return <p className="credit">Fetching from Wikipedia…</p>;
  if (!d) return <p className="credit">No live Wikipedia summary available ({data.ok ? "" : data.reason}).</p>;
  return (
    <div>
      {d.thumbnailUrl && (
        <div className="frame" style={{ height: 220 }}>
          <Image src={d.thumbnailUrl} alt={d.title} fill unoptimized style={{ objectFit: "cover" }} sizes="400px" />
        </div>
      )}
      <p>{d.extract}</p>
      <p className="credit">From Wikipedia, <a href={d.pageUrl} target="_blank" rel="noreferrer">“{d.title}”</a> · text CC BY-SA 4.0</p>
    </div>
  );
}

function EventPanel({ id }: { id: string }) {
  const { events, tours, dispatch } = useHistory();
  const e = events.find((x) => x.id === id);
  const related = useMemo(() => (e ? relatedEvents(e, events, tours) : []), [e, events, tours]);
  const [copied, setCopied] = useState(false);
  if (!e) return null;
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
    <aside className="panel" key={e.id}>
      <button className="close" onClick={() => dispatch({ type: "select", selection: null })} aria-label="Close">×</button>
      <span className="chip" style={{ background: CATEGORY_COLORS[e.category] }}>{e.category}</span>
      <div className="meta" style={{ marginTop: 8 }}>{formatYear(e.year)}{e.endYear ? ` – ${formatYear(e.endYear)}` : ""} · importance {e.importance}/5</div>
      <h2>{e.title}</h2>
      {e.story && <p className="panel-tagline">{e.story.tagline}</p>}
      <button className={`story-cta ${e.story ? "curated" : ""}`} onClick={() => dispatch({ type: "openStory", id: e.id })}>
        <span>▶</span>
        <span>
          <b>{e.story ? "Enter the immersive story" : "Open in story mode"}</b>
          <em>{e.story ? `${e.story.chapters.length} chapters · fly through it on the globe` : "A cinematic tour of this moment"} · S</em>
        </span>
      </button>
      <p>{e.summary}</p>
      {e.videoUrl && (
        <div className="frame">
          <video controls preload="metadata" src={e.videoUrl} />
          <div className="credit" style={{ padding: "4px 6px" }}>{e.videoCredit ?? "Wikimedia Commons"}</div>
        </div>
      )}
      <WikiBlock title={e.wikipediaTitle} />
      {e.belligerents && (
        <p className="credit">Sides: {e.belligerents.filter((b) => b.side === "a").map((b) => b.name).join(", ")} vs {e.belligerents.filter((b) => b.side === "b").map((b) => b.name).join(", ")}</p>
      )}
      {related.length > 0 && (
        <div className="list">
          <div className="meta" style={{ margin: "10px 0 4px" }}>Related</div>
          {related.map((r) => (
            <button key={r.id} onClick={() => { dispatch({ type: "setYear", year: r.year }); dispatch({ type: "select", selection: { kind: "event", id: r.id }, fly: true }); }}>
              <i className="dot" style={{ background: CATEGORY_COLORS[r.category] }} /> <span className="meta">{formatYear(r.year)}</span> · {r.title}{r.story ? " ✦" : ""}
            </button>
          ))}
        </div>
      )}
      <div className="panel-nav">
        <button className="btn secondary" onClick={() => dispatch({ type: "stepEvent", delta: -1 })}>← Earlier</button>
        <button className="btn secondary" onClick={share}>{copied ? "Link copied ✓" : "Copy link"}</button>
        <button className="btn secondary" onClick={() => dispatch({ type: "stepEvent", delta: 1 })}>Later →</button>
      </div>
      <p className="credit">Sources: {e.sources.map((s, i) => <a key={s} href={s} target="_blank" rel="noreferrer">[{i + 1}] </a>)}</p>
    </aside>
  );
}

function CountryPanel({ feature }: { feature: BorderFeature }) {
  const { state, events, dispatch } = useHistory();
  const name = (feature.properties.NAME ?? "").trim();
  const country = state.countries.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const list: HistoryEvent[] = events.filter((e) => country && e.countryIso === country.iso2).sort((a, b) => a.year - b.year);
  const title = country ? `History of ${country.name}` : name;
  return (
    <aside className="panel">
      <button className="close" onClick={() => dispatch({ type: "select", selection: null })} aria-label="Close">×</button>
      <div className="meta">In {formatYear(state.year)}</div>
      <h2>{polityDisplayName(feature)}</h2>
      {country && (
        <p className="credit">
          {country.flagUrl && <Image src={country.flagUrl} alt="" width={28} height={18} unoptimized style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />}
          Today: <b>{country.name}</b>{country.capital ? ` · capital ${country.capital}` : ""}{country.inceptionYear ? ` · founded ${formatYear(country.inceptionYear)}` : ""}{country.population ? ` · ${country.population.toLocaleString("en")} people` : ""}
        </p>
      )}
      <WikiBlock title={title} fallback={country?.name ?? name} />
      {list.length > 0 && (
        <div className="list">
          <div className="meta" style={{ margin: "8px 0 4px" }}>Events here</div>
          {list.map((e) => (
            <button key={e.id} onClick={() => { dispatch({ type: "setYear", year: e.year }); dispatch({ type: "select", selection: { kind: "event", id: e.id }, fly: true }); }}>
              <span className="meta">{formatYear(e.year)}</span> · {e.title}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function TourPlayer() {
  const { state, tours, events, dispatch } = useHistory();
  const tour = tours.find((t) => t.id === state.tour?.id);
  const stop = tour?.stops[state.tour?.stop ?? 0];
  const ev = stop && events.find((e) => e.id === stop.eventId);
  if (!tour || !stop) return null;
  return (
    <div className="tour">
      <div className="meta" style={{ color: "#b8892b" }}>{tour.title} · stop {(state.tour?.stop ?? 0) + 1} of {tour.stops.length}</div>
      <h3>{ev ? `${formatYear(ev.year)} — ${ev.title}` : stop.eventId}</h3>
      <p>{stop.narration}</p>
      <div className="controls">
        <button className="btn" onClick={() => dispatch({ type: "tourStep", delta: -1 })}>← Back</button>
        <button className="btn" onClick={() => dispatch({ type: "tourStep", delta: 1 })}>Next →</button>
        {ev && <button className="btn" onClick={() => dispatch({ type: "openStory", id: ev.id })}>{ev.story ? "✦ Immersive story" : "Story mode"}</button>}
        <button className="btn" onClick={() => dispatch({ type: "endTour" })}>Exit</button>
      </div>
    </div>
  );
}
