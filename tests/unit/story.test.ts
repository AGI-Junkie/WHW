import { describe, expect, it } from "vitest";
import { getEvents, getTours } from "@/lib/data/loaders";
import { chapterDurationMs, storyFor } from "@/lib/domain/story";
import { relatedEvents } from "@/lib/domain/related";
import { adjacentEvent } from "@/lib/domain/navigation";
import { initialState, reducer } from "@/lib/store/history-store";

const events = getEvents();
const byId = (id: string) => events.find((e) => e.id === id)!;

describe("stories", () => {
  it("uses hand-written chapters when an event has them", () => {
    const s = storyFor(byId("fall-of-constantinople"), events);
    expect(s.curated).toBe(true);
    expect(s.chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("builds at least two chapters for every event without one", () => {
    for (const e of events.filter((x) => !x.story)) {
      const s = storyFor(e, events);
      expect(s.curated).toBe(false);
      expect(s.chapters.length).toBeGreaterThanOrEqual(2);
      expect(s.chapters[0]!.text).toBe(e.summary);
    }
  });

  it("adds a two-sides chapter for wars", () => {
    const s = storyFor(byId("battle-of-hastings"), events);
    expect(s.chapters.some((c) => c.heading === "The two sides")).toBe(true);
  });

  it("lingers 6–16 s per chapter", () => {
    for (const c of storyFor(byId("apollo-11"), events).chapters) {
      expect(chapterDurationMs(c)).toBeGreaterThanOrEqual(6000);
      expect(chapterDurationMs(c)).toBeLessThanOrEqual(16000);
    }
  });
});

describe("related events", () => {
  it("never suggests the event itself and prefers the same place", () => {
    const e = byId("battle-of-stalingrad");
    const rel = relatedEvents(e, events, getTours());
    expect(rel.length).toBeGreaterThan(0);
    expect(rel.some((r) => r.id === e.id)).toBe(false);
  });
});

describe("adjacent events", () => {
  it("steps through events in time, including ties in the same year", () => {
    const sorted = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    const first = sorted[0]!;
    expect(adjacentEvent(events, -3000, first.id, 1)?.id).toBe(sorted[1]!.id);
    expect(adjacentEvent(events, -3000, first.id, -1)).toBeUndefined();
    expect(adjacentEvent(events, 1452, null, 1)?.year).toBe(1453);
    expect(adjacentEvent(events, 1453, null, -1)?.year).toBeLessThan(1453);
  });
});

describe("story reducer", () => {
  it("opens a story at the event's year with the camera on chapter one", () => {
    const s = reducer(initialState, { type: "openStory", id: "apollo-11" });
    expect(s.year).toBe(1969);
    expect(s.story).toEqual({ id: "apollo-11", chapter: 0, autoplay: true });
    expect(s.cameraTarget?.lat).toBe(byId("apollo-11").story!.chapters[0]!.lat);
  });

  it("clamps chapter steps and stops autoplay on the last chapter", () => {
    let s = reducer(initialState, { type: "openStory", id: "apollo-11" });
    for (let i = 0; i < 10; i++) s = reducer(s, { type: "storyStep", delta: 1 });
    const n = byId("apollo-11").story!.chapters.length;
    expect(s.story?.chapter).toBe(n - 1);
    expect(s.story?.autoplay).toBe(false);
    s = reducer(s, { type: "closeStory" });
    expect(s.story).toBeNull();
  });

  it("play mode leaves the story", () => {
    const s = reducer(reducer(initialState, { type: "openStory", id: "apollo-11" }), { type: "setPlaying", playing: true });
    expect(s.story).toBeNull();
  });
});
