import type { BorderFeature, Category, Country, HistoryEvent, Tour } from "@/lib/data/schemas";
import { getEventById, getEvents, getTours } from "@/lib/data/loaders";
import { MAX_YEAR } from "@/lib/data/schemas";
import { nextYear } from "@/lib/domain/time-scale";
import { eventsHappening, headlineEvent } from "@/lib/domain/visible-events";
import {
  completeTour,
  discoverCountry,
  discoverEvent,
  EMPTY_DISCOVERY,
  type DiscoveryState,
} from "@/lib/domain/discovery";
import { polityDisplayName } from "@/lib/domain/palette";
import { storyFor } from "@/lib/domain/story";
import { adjacentEvent } from "@/lib/domain/navigation";
import { buildMyTour, MY_TOUR_ID, MY_TOUR_MAX, toggleMyTour } from "@/lib/domain/my-tour";
import { distanceKm, pickQuizEvent, QUIZ_ROUNDS, quizPoints } from "@/lib/domain/quiz";
import type { GlobeCameraTarget } from "@/components/globe/globe-types";

/** The app's state machine: pure, so every transition can be unit-tested without React. */
export type Speed = 1 | 2 | 4;
export type Selection =
  { kind: "event"; id: string } | { kind: "country"; feature: BorderFeature } | null;

export interface Pulse {
  id: string;
  lat: number;
  lng: number;
  importance: number;
  until: number;
}

/** "Where did it happen?": the event to place, the visitor's pin once they guessed, the running score. */
export interface QuizState {
  round: number;
  asked: string[];
  eventId: string;
  guess: { lat: number; lng: number } | null;
  km: number | null;
  points: number | null;
  total: number;
  done: boolean;
}

/** The three lazy loads. A failure stays on screen until that same load succeeds again. */
export type DataSource = "countries" | "snapshotIndex" | "snapshot";

export interface HistoryState {
  year: number;
  playing: boolean;
  speed: Speed;
  follow: boolean;
  selection: Selection;
  tour: { id: string; stop: number } | null;
  /** The immersive story view: which event, which chapter, and whether it advances by itself. */
  story: { id: string; chapter: number; autoplay: boolean } | null;
  cameraTarget: GlobeCameraTarget | null;
  pulses: Pulse[];
  discovery: DiscoveryState;
  countries: Country[];
  snapshotYears: number[];
  snapshotYear: number | null;
  polygons: BorderFeature[];
  hiddenCategories: Category[];
  error: { source: DataSource; message: string } | null;
  /** Bumped by the retry button so the data fetch effects run again. */
  retry: number;
  /** Event ids of the visitor's own tour (persisted per browser, shareable by link). */
  myTour: string[];
  /** A second border snapshot drawn as outlines over the current one, or null. */
  compareYear: number | null;
  quiz: QuizState | null;
}

export type Action =
  | { type: "setYear"; year: number }
  | { type: "tick" }
  | { type: "setPlaying"; playing: boolean }
  | { type: "setSpeed"; speed: Speed }
  | { type: "toggleFollow" }
  | { type: "select"; selection: Selection; fly?: boolean }
  | { type: "startTour"; id: string }
  | { type: "tourStep"; delta: 1 | -1 }
  | { type: "endTour" }
  | { type: "openStory"; id: string; chapter?: number }
  | { type: "storyStep"; delta: 1 | -1 }
  | { type: "storyGo"; chapter: number }
  | { type: "storyAutoplay"; autoplay: boolean }
  | { type: "closeStory" }
  | { type: "stepEvent"; delta: 1 | -1 }
  | { type: "randomEvent"; seed: number }
  | { type: "flyTo"; target: GlobeCameraTarget }
  | { type: "countriesLoaded"; countries: Country[] }
  | { type: "snapshotIndexLoaded"; years: number[] }
  | { type: "snapshotLoaded"; year: number; features: BorderFeature[] }
  | { type: "error"; source: DataSource; message: string }
  | { type: "retry" }
  | { type: "toggleCategory"; category: Category }
  | { type: "setHiddenCategories"; categories: Category[] }
  | { type: "discoveryLoaded"; discovery: DiscoveryState }
  | { type: "prunePulses"; now: number }
  | { type: "toggleMyTour"; id: string }
  | { type: "myTourLoaded"; ids: string[] }
  | { type: "setCompare"; year: number | null }
  | { type: "quizStart"; seed: number }
  | { type: "quizGuess"; lat: number; lng: number }
  | { type: "quizNext"; seed: number }
  | { type: "quizEnd" };

const START_YEAR = 1950;
export const TICKS_PER_SECOND = 3;

export const initialState: HistoryState = {
  year: START_YEAR,
  playing: false,
  speed: 1,
  follow: false,
  selection: null,
  tour: null,
  story: null,
  cameraTarget: null,
  pulses: [],
  discovery: EMPTY_DISCOVERY,
  countries: [],
  snapshotYears: [],
  snapshotYear: null,
  polygons: [],
  hiddenCategories: [],
  error: null,
  retry: 0,
  myTour: [],
  compareYear: null,
  quiz: null,
};

function findTour(s: HistoryState, id: string): Tour | undefined {
  return id === MY_TOUR_ID
    ? (buildMyTour(s.myTour, getEvents()) ?? undefined)
    : getTours().find((t) => t.id === id);
}

/** Editing My tour while it plays would leave the player on a stop index that no longer matches: end it. */
function endEditedTour(s: HistoryState, myTour: string[]): HistoryState {
  return { ...s, myTour, ...(s.tour?.id === MY_TOUR_ID ? { tour: null } : {}) };
}

/** A quiz round: jump to the event's year (its borders are the hint) and pull the camera back. */
function quizRound(
  s: HistoryState,
  ev: HistoryEvent,
  round: number,
  asked: string[],
  total: number,
): HistoryState {
  return {
    ...s,
    year: ev.year,
    playing: false,
    selection: null,
    tour: null,
    story: null,
    cameraTarget: {
      lat: 25,
      lng: ev.lng > 60 ? 80 : ev.lng < -40 ? -70 : 15,
      altitude: 2.4,
      durationMs: 1200,
    },
    quiz: {
      round,
      asked: [...asked, ev.id],
      eventId: ev.id,
      guess: null,
      km: null,
      points: null,
      total,
      done: false,
    },
  };
}

function applyStop(s: HistoryState, tour: Tour, idx: number): HistoryState {
  const stop = tour.stops[idx];
  const ev = stop ? getEventById(stop.eventId) : undefined;
  if (!stop || !ev) return s;
  return {
    ...s,
    tour: { id: tour.id, stop: idx },
    year: ev.year,
    playing: false,
    selection: { kind: "event", id: ev.id },
    cameraTarget: { lat: ev.lat, lng: ev.lng, altitude: stop.altitude, durationMs: 1800 },
    discovery: discoverEvent(s.discovery, ev.id),
  };
}

function applyChapter(
  s: HistoryState,
  id: string,
  chapter: number,
  autoplay: boolean,
): HistoryState {
  const events = getEvents();
  const ev = getEventById(id);
  if (!ev) return s;
  const story = storyFor(ev, events);
  const idx = Math.max(0, Math.min(story.chapters.length - 1, chapter));
  const c = story.chapters[idx]!;
  return {
    ...s,
    story: { id, chapter: idx, autoplay: autoplay && idx < story.chapters.length - 1 },
    year: ev.year,
    playing: false,
    tour: null,
    selection: { kind: "event", id },
    cameraTarget: { lat: c.lat, lng: c.lng, altitude: c.altitude, durationMs: 2200 },
    discovery: discoverEvent(s.discovery, id),
  };
}

function selectEvent(s: HistoryState, ev: HistoryEvent): HistoryState {
  return {
    ...s,
    year: ev.year,
    playing: false,
    selection: { kind: "event", id: ev.id },
    discovery: discoverEvent(s.discovery, ev.id),
    cameraTarget: { lat: ev.lat, lng: ev.lng, altitude: 1.3, durationMs: 1200 },
  };
}

/** A lazy load that finally succeeds clears only the error that load reported. */
function loaded(s: HistoryState, patch: Partial<HistoryState>, source: DataSource): HistoryState {
  return { ...s, ...patch, error: s.error?.source === source ? null : s.error };
}

export function reducer(s: HistoryState, a: Action): HistoryState {
  switch (a.type) {
    case "setYear":
      // Moving the timeline mid-quiz would swap the borders that are the round's clue: leave the quiz.
      return { ...s, year: a.year, quiz: null };
    case "tick": {
      const next = nextYear(s.year, 1);
      if (next === s.year || s.year >= MAX_YEAR) return { ...s, playing: false };
      const events = getEvents();
      const now = Date.now();
      const born = eventsHappening(events, s.year, next).map<Pulse>((e) => ({
        id: `${e.id}@${next}`,
        lat: e.lat,
        lng: e.lng,
        importance: e.importance,
        until: now + 2400,
      }));
      const pulses = [...s.pulses.filter((p) => p.until > now), ...born];
      const head = s.follow ? headlineEvent(events, s.year, next) : undefined;
      return {
        ...s,
        year: next,
        pulses,
        ...(head && head.importance >= 4
          ? { cameraTarget: { lat: head.lat, lng: head.lng, altitude: 1.6, durationMs: 900 } }
          : {}),
      };
    }
    case "setPlaying":
      return {
        ...s,
        playing: a.playing,
        ...(a.playing ? { tour: null, story: null, quiz: null } : {}),
      };
    case "setSpeed":
      return { ...s, speed: a.speed };
    case "toggleFollow":
      return { ...s, follow: !s.follow };
    case "select": {
      if (a.selection === null) return { ...s, selection: null };
      if (a.selection.kind === "event") {
        const sel = a.selection;
        const ev = getEventById(sel.id);
        return {
          ...s,
          quiz: null,
          selection: sel,
          discovery: discoverEvent(s.discovery, sel.id),
          ...(a.fly && ev
            ? { cameraTarget: { lat: ev.lat, lng: ev.lng, altitude: 1.2, durationMs: 1200 } }
            : {}),
        };
      }
      return {
        ...s,
        quiz: null,
        selection: a.selection,
        discovery: discoverCountry(s.discovery, polityDisplayName(a.selection.feature)),
      };
    }
    case "startTour": {
      const tour = findTour(s, a.id);
      return tour ? applyStop({ ...s, story: null, quiz: null }, tour, 0) : s;
    }
    case "tourStep": {
      if (!s.tour) return s;
      const tour = findTour(s, s.tour.id);
      if (!tour) return { ...s, tour: null };
      const idx = s.tour.stop + a.delta;
      if (idx < 0) return s;
      if (idx >= tour.stops.length) {
        return { ...s, tour: null, discovery: completeTour(s.discovery, tour.id) };
      }
      return applyStop(s, tour, idx);
    }
    case "endTour":
      return { ...s, tour: null };
    case "openStory":
      return applyChapter({ ...s, quiz: null }, a.id, a.chapter ?? 0, a.chapter === undefined);
    case "storyStep":
      return s.story ? applyChapter(s, s.story.id, s.story.chapter + a.delta, s.story.autoplay) : s;
    case "storyGo":
      return s.story ? applyChapter(s, s.story.id, a.chapter, false) : s;
    case "storyAutoplay":
      return s.story ? { ...s, story: { ...s.story, autoplay: a.autoplay } } : s;
    case "closeStory":
      return { ...s, story: null };
    case "stepEvent": {
      const selectedId = s.selection?.kind === "event" ? s.selection.id : null;
      const ev = adjacentEvent(getEvents(), s.year, selectedId, a.delta, s.hiddenCategories);
      return ev ? selectEvent({ ...s, tour: null, quiz: null }, ev) : s;
    }
    case "randomEvent": {
      const pool = getEvents().filter(
        (e) => e.importance >= 3 && !s.hiddenCategories.includes(e.category),
      );
      const ev = pool[Math.abs(Math.floor(a.seed)) % Math.max(1, pool.length)];
      return ev ? selectEvent({ ...s, tour: null, story: null, quiz: null }, ev) : s;
    }
    case "flyTo":
      return { ...s, cameraTarget: a.target };
    case "countriesLoaded":
      return loaded(s, { countries: a.countries }, "countries");
    case "snapshotIndexLoaded":
      return loaded(s, { snapshotYears: a.years }, "snapshotIndex");
    case "snapshotLoaded":
      return loaded(s, { snapshotYear: a.year, polygons: a.features }, "snapshot");
    case "error":
      return { ...s, error: { source: a.source, message: a.message } };
    case "retry":
      return { ...s, error: null, retry: s.retry + 1 };
    case "toggleCategory":
      return {
        ...s,
        hiddenCategories: s.hiddenCategories.includes(a.category)
          ? s.hiddenCategories.filter((c) => c !== a.category)
          : [...s.hiddenCategories, a.category],
      };
    case "setHiddenCategories":
      return { ...s, hiddenCategories: [...new Set(a.categories)] };
    case "discoveryLoaded":
      return { ...s, discovery: a.discovery };
    case "prunePulses":
      return s.pulses.some((p) => p.until <= a.now)
        ? { ...s, pulses: s.pulses.filter((p) => p.until > a.now) }
        : s;
    case "toggleMyTour":
      return endEditedTour(s, toggleMyTour(s.myTour, a.id));
    case "myTourLoaded": {
      // Storage and #t= links are untrusted: keep known, unique event ids only, capped.
      const known = new Set(getEvents().map((e) => e.id));
      return endEditedTour(
        s,
        [...new Set(a.ids)].filter((id) => known.has(id)).slice(0, MY_TOUR_MAX),
      );
    }
    case "setCompare":
      return { ...s, compareYear: a.year };
    case "quizStart": {
      const ev = pickQuizEvent(getEvents(), a.seed, []);
      return ev ? quizRound({ ...s, compareYear: null }, ev, 1, [], 0) : s;
    }
    case "quizGuess": {
      const q = s.quiz;
      const ev = q && !q.guess ? getEventById(q.eventId) : undefined;
      if (!q || !ev) return s;
      const km = distanceKm({ lat: a.lat, lng: a.lng }, ev);
      const points = quizPoints(km);
      return {
        ...s,
        quiz: { ...q, guess: { lat: a.lat, lng: a.lng }, km, points, total: q.total + points },
        cameraTarget: {
          lat: (a.lat + ev.lat) / 2,
          lng: ev.lng,
          altitude: Math.min(2.6, 0.9 + km / 4000),
          durationMs: 1400,
        },
        discovery: discoverEvent(s.discovery, ev.id),
      };
    }
    case "quizNext": {
      const q = s.quiz;
      if (!q?.guess) return s;
      if (q.round >= QUIZ_ROUNDS) return { ...s, quiz: { ...q, done: true } };
      const ev = pickQuizEvent(getEvents(), a.seed, q.asked);
      return ev
        ? quizRound(s, ev, q.round + 1, q.asked, q.total)
        : { ...s, quiz: { ...q, done: true } };
    }
    case "quizEnd":
      return { ...s, quiz: null };
    default:
      return s;
  }
}
