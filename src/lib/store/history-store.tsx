"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type { Category, Era, HistoryEvent, Tour } from "@/lib/data/schemas";
import {
  fetchCountries,
  fetchSnapshot,
  fetchSnapshotIndex,
  getEras,
  getEvents,
  getEventsIn,
  getTours,
} from "@/lib/data/loaders";
import { useI18n } from "@/lib/i18n";
import { pickSnapshotYear } from "@/lib/domain/snapshot";
import type { DiscoveryState } from "@/lib/domain/discovery";
import { chapterDurationMs, storyFor } from "@/lib/domain/story";
import { buildDeepLink, parseDeepLink } from "@/lib/domain/deep-link";
import { MY_TOUR_ID } from "@/lib/domain/my-tour";
import {
  initialState,
  reducer,
  TICKS_PER_SECOND,
  type Action,
  type DataSource,
  type HistoryState,
} from "./reducer";

export * from "./reducer";

const DISCOVERY_KEY = "whw-discovery-v1";
const MY_TOUR_KEY = "whw-my-tour-v1";

interface HistoryContextValue {
  state: HistoryState;
  dispatch: Dispatch<Action>;
  events: HistoryEvent[];
  tours: Tour[];
  eras: Era[];
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

/** A failed lazy load records which source failed, so only that error is shown and cleared. */
function failure(source: DataSource, e: unknown): Action {
  return { type: "error", source, message: String(e) };
}

function loadDiscovery(): DiscoveryState | null {
  try {
    const raw = window.localStorage.getItem(DISCOVERY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Partial<DiscoveryState>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      events: arr(p.events),
      countries: arr(p.countries),
      toursCompleted: arr(p.toursCompleted),
    };
  } catch {
    return null;
  }
}

function loadMyTour(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(MY_TOUR_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wantedSnapshot = useRef<number | null>(null);

  // Static data is parsed once through the Zod contracts. The UI gets the events in its language;
  // the reducer works on ids and places, which are the same in both.
  const { locale } = useI18n();
  const events = useMemo(() => getEventsIn(locale), [locale]);
  const tours = useMemo(() => getTours(), []);
  const eras = useMemo(() => getEras(), []);

  // Generated data (countries, snapshot index).
  useEffect(() => {
    fetchCountries()
      .then((countries) => dispatch({ type: "countriesLoaded", countries }))
      .catch((e: unknown) => dispatch(failure("countries", e)));
    fetchSnapshotIndex()
      .then((years) => dispatch({ type: "snapshotIndexLoaded", years }))
      .catch((e: unknown) => dispatch(failure("snapshotIndex", e)));
  }, [state.retry]);

  // Border snapshot for the current year (latest snapshot ≤ year), fetched lazily and cached.
  useEffect(() => {
    if (state.snapshotYears.length === 0) return;
    const target = pickSnapshotYear(state.year, state.snapshotYears);
    if (target === state.snapshotYear || wantedSnapshot.current === target) return;
    wantedSnapshot.current = target;
    fetchSnapshot(target)
      .then((features) => {
        if (wantedSnapshot.current === target) {
          dispatch({ type: "snapshotLoaded", year: target, features });
        }
        // Warm the neighbouring snapshots so scrubbing or playing across a boundary does not stall.
        const sorted = [...state.snapshotYears].sort((a, b) => a - b);
        const i = sorted.indexOf(target);
        const warm = () =>
          [sorted[i - 1], sorted[i + 1]].forEach(
            (y) => y !== undefined && void fetchSnapshot(y).catch(() => {}),
          );
        if ("requestIdleCallback" in window)
          window.requestIdleCallback(warm, { timeout: 2000 }); // a busy WebGL frame loop may never go idle
        else setTimeout(warm, 500); // Safari has no requestIdleCallback
      })
      .catch((e: unknown) => {
        if (wantedSnapshot.current !== target) return; // a newer request owns the state now
        wantedSnapshot.current = null; // otherwise the guard above blocks every retry
        dispatch(failure("snapshot", e));
      });
  }, [state.year, state.snapshotYears, state.snapshotYear, state.retry]);

  // Play loop.
  useEffect(() => {
    if (!state.playing) return;
    const id = window.setInterval(
      () => dispatch({ type: "tick" }),
      1000 / (TICKS_PER_SECOND * state.speed),
    );
    return () => window.clearInterval(id);
  }, [state.playing, state.speed]);

  // Ring pulses fade out even while paused.
  useEffect(() => {
    if (state.pulses.length === 0) return;
    const id = window.setInterval(() => dispatch({ type: "prunePulses", now: Date.now() }), 500);
    return () => window.clearInterval(id);
  }, [state.pulses.length]);

  // Discovery progress persists per browser.
  useEffect(() => {
    const saved = loadDiscovery();
    if (saved) dispatch({ type: "discoveryLoaded", discovery: saved });
    const mine = loadMyTour();
    if (mine.length) dispatch({ type: "myTourLoaded", ids: mine });
  }, []);
  const myTourLoaded = useRef(false);
  useEffect(() => {
    // Skip the first run so the empty initial list does not overwrite what is saved.
    if (!myTourLoaded.current) {
      myTourLoaded.current = true;
      return;
    }
    try {
      window.localStorage.setItem(MY_TOUR_KEY, JSON.stringify(state.myTour));
    } catch {
      /* storage may be unavailable */
    }
  }, [state.myTour]);
  useEffect(() => {
    try {
      window.localStorage.setItem(DISCOVERY_KEY, JSON.stringify(state.discovery));
    } catch {
      /* storage may be unavailable; progress is a convenience */
    }
  }, [state.discovery]);

  // Story autoplay: linger on each chapter long enough to read it, then move on.
  useEffect(() => {
    const st = state.story;
    if (!st?.autoplay) return;
    const ev = events.find((e) => e.id === st.id);
    const chapter = ev && storyFor(ev, events).chapters[st.chapter];
    if (!chapter) return;
    const id = window.setTimeout(
      () => dispatch({ type: "storyStep", delta: 1 }),
      chapterDurationMs(chapter),
    );
    return () => window.clearTimeout(id);
  }, [state.story, events]);

  // Deep links: the hash is read once on load, then kept in step with the view (replaceState, so
  // scrubbing does not flood the history). Throttled because play mode changes the year 3–12×/s.
  useEffect(() => {
    const link = parseDeepLink(window.location.hash);
    const ev = link.eventId ? getEvents().find((e) => e.id === link.eventId) : undefined;
    if (link.hidden) dispatch({ type: "setHiddenCategories", categories: link.hidden });
    if (link.tour) {
      dispatch({ type: "myTourLoaded", ids: link.tour });
      dispatch({ type: "startTour", id: MY_TOUR_ID });
    } else if (ev && link.story) dispatch({ type: "openStory", id: ev.id, chapter: 0 });
    else if (ev) {
      dispatch({ type: "setYear", year: link.year ?? ev.year });
      dispatch({ type: "select", selection: { kind: "event", id: ev.id }, fly: true });
    } else if (link.year !== undefined) dispatch({ type: "setYear", year: link.year });
  }, []);
  const linkYear = state.year;
  const linkEvent = state.selection?.kind === "event" ? state.selection.id : undefined;
  const linkStory = state.story !== null;
  // While My tour plays, the address keeps the tour itself, so reloading or copying it reopens the tour.
  const linkTour = state.tour?.id === MY_TOUR_ID ? state.myTour.join(",") : "";
  const linkHidden = state.hiddenCategories.join(",");
  useEffect(() => {
    const id = window.setTimeout(() => {
      const hidden = linkHidden ? (linkHidden.split(",") as Category[]) : [];
      const hash = linkTour
        ? buildDeepLink({ tour: linkTour.split(","), hidden })
        : buildDeepLink({
            year: linkYear,
            story: linkStory,
            hidden,
            ...(linkEvent ? { eventId: linkEvent } : {}),
          });
      if (hash !== window.location.hash) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${hash}`,
        );
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [linkYear, linkEvent, linkStory, linkTour, linkHidden]);

  // Keyboard: space = play/pause (story: autoplay), escape = close the innermost layer,
  // ← → = story chapters, tour stops, or the previous/next event in time. A layout effect, so the
  // handler sees the new state before the frame that shows it: a key pressed on a just-opened story
  // must not hit the previous closure.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button keeps its native Space/Enter activation.
      if (target?.tagName === "BUTTON" && (e.code === "Space" || e.key === "Enter")) return;
      const story = state.story;
      if (state.quiz) {
        // The quiz is played with the mouse; only Esc applies, so no key can reveal the answer.
        if (e.key === "Escape") dispatch({ type: "quizEnd" });
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (story) dispatch({ type: "storyAutoplay", autoplay: !story.autoplay });
        else dispatch({ type: "setPlaying", playing: !state.playing });
      } else if (e.key === "Escape") {
        if (story) dispatch({ type: "closeStory" });
        else dispatch(state.tour ? { type: "endTour" } : { type: "select", selection: null });
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const delta = e.key === "ArrowRight" ? 1 : -1;
        e.preventDefault();
        if (story) dispatch({ type: "storyStep", delta });
        else if (state.tour) dispatch({ type: "tourStep", delta });
        else dispatch({ type: "stepEvent", delta });
      } else if (
        (e.key === "s" || e.key === "Enter") &&
        !story &&
        state.selection?.kind === "event"
      ) {
        dispatch({ type: "openStory", id: state.selection.id });
      } else if (e.key === "r" && !story) {
        dispatch({ type: "randomEvent", seed: Math.random() * 1e9 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.playing, state.tour, state.story, state.selection, state.quiz]);

  const value = useMemo(
    () => ({ state, dispatch, events, tours, eras }),
    [state, events, tours, eras],
  );
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside <HistoryProvider>");
  return ctx;
}
