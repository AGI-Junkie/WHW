import { describe, expect, it } from "vitest";
import { initialState, reducer, type HistoryState } from "@/lib/store/history-store";
import { getTours } from "@/lib/data/loaders";
import { MAX_YEAR } from "@/lib/data/schemas";

const tour = getTours()[0]!;
const start = (s: HistoryState = initialState) => reducer(s, { type: "startTour", id: tour.id });

describe("reducer: playback", () => {
  it("advances the year on tick and spawns pulses for events that happen", () => {
    const s = reducer({ ...initialState, year: 1938, playing: true }, { type: "tick" });
    expect(s.year).toBeGreaterThan(1938);
    const p = reducer({ ...initialState, year: 1938 }, { type: "tick" });
    expect(p.pulses.some((x) => x.id.startsWith("invasion-of-poland@"))).toBe(true);
  });

  it("stops at the final year", () => {
    const s = reducer({ ...initialState, year: MAX_YEAR, playing: true }, { type: "tick" });
    expect(s.playing).toBe(false);
    expect(s.year).toBe(MAX_YEAR);
  });

  it("only flies the camera with Follow on and a major event", () => {
    const off = reducer({ ...initialState, year: 1938 }, { type: "tick" });
    expect(off.cameraTarget).toBeNull();
    const on = reducer({ ...initialState, year: 1938, follow: true }, { type: "tick" });
    expect(on.cameraTarget).not.toBeNull();
  });

  it("starting playback leaves any tour", () => {
    expect(reducer(start(), { type: "setPlaying", playing: true }).tour).toBeNull();
  });

  it("prunes expired pulses only", () => {
    const pulses = [
      { id: "old", lat: 0, lng: 0, importance: 1, until: 10 },
      { id: "new", lat: 0, lng: 0, importance: 1, until: 100 },
    ];
    const s = reducer({ ...initialState, pulses }, { type: "prunePulses", now: 50 });
    expect(s.pulses.map((p) => p.id)).toEqual(["new"]);
    const same = reducer(s, { type: "prunePulses", now: 50 });
    expect(same).toBe(s);
  });
});

describe("reducer: selection and discovery", () => {
  it("selecting an event records discovery and optionally flies there", () => {
    const s = reducer(initialState, {
      type: "select",
      selection: { kind: "event", id: "invasion-of-poland" },
      fly: true,
    });
    expect(s.discovery.events).toContain("invasion-of-poland");
    expect(s.cameraTarget).not.toBeNull();
    expect(reducer(s, { type: "select", selection: null }).selection).toBeNull();
  });

  it("toggles category filters", () => {
    const a = reducer(initialState, { type: "toggleCategory", category: "war" });
    expect(a.hiddenCategories).toEqual(["war"]);
    expect(reducer(a, { type: "toggleCategory", category: "war" }).hiddenCategories).toEqual([]);
  });
});

describe("reducer: tours", () => {
  it("starts at the first stop, jumping the year and selecting its event", () => {
    const s = start();
    expect(s.tour).toEqual({ id: tour.id, stop: 0 });
    expect(s.selection).toEqual({ kind: "event", id: tour.stops[0]!.eventId });
    expect(s.playing).toBe(false);
  });

  it("ignores unknown tours and backing out of the first stop", () => {
    expect(reducer(initialState, { type: "startTour", id: "nope" })).toBe(initialState);
    const s = start();
    expect(reducer(s, { type: "tourStep", delta: -1 })).toBe(s);
  });

  it("completes the tour (and records it) after the last stop", () => {
    let s = start();
    for (let i = 0; i < tour.stops.length; i++) s = reducer(s, { type: "tourStep", delta: 1 });
    expect(s.tour).toBeNull();
    expect(s.discovery.toursCompleted).toContain(tour.id);
  });
});
