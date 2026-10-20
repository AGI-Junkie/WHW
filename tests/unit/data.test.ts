import { describe, expect, it } from "vitest";
import { getEras, getEvents, getEventsIn, getEventsZh, getTours } from "@/lib/data/loaders";
import { eraForYear } from "@/lib/domain/eras";
import { pickSnapshotYear } from "@/lib/domain/snapshot";
import { SNAPSHOT_YEARS } from "@/lib/data/paths";
import { initialState, reducer } from "@/lib/store/reducer";

describe("curated data", () => {
  it("parses through the schemas with unique event ids", () => {
    const events = getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("has Chinese texts that line up with the English events", () => {
    const byId = new Map(getEvents().map((e) => [e.id, e]));
    const zh = getEventsZh();
    expect(Object.keys(zh).length).toBe(byId.size); // every event has at least a Chinese title
    for (const [id, z] of Object.entries(zh)) {
      const en = byId.get(id);
      expect(en, id).toBeDefined();
      if (!z.story) continue;
      expect(en!.story, `${id} has a zh story but no English one`).toBeDefined();
      expect(z.story.chapters.length, id).toBe(en!.story!.chapters.length);
      expect(z.story.facts.length, id).toBe(en!.story!.facts.length);
      expect(Boolean(z.story.quote), id).toBe(Boolean(en!.story!.quote));
    }
  });

  it("localizes texts but keeps ids, years and the camera path", () => {
    const en = getEvents();
    const zh = getEventsIn("zh");
    expect(getEventsIn("en")).toBe(en);
    zh.forEach((z, i) => {
      const e = en[i]!;
      expect([z.id, z.year, z.lat, z.lng, z.category]).toEqual([
        e.id,
        e.year,
        e.lat,
        e.lng,
        e.category,
      ]);
      e.story?.chapters.forEach((c, j) => {
        const zc = z.story!.chapters[j]!;
        expect([zc.lat, zc.lng, zc.altitude]).toEqual([c.lat, c.lng, c.altitude]);
      });
    });
    const giza = zh.find((e) => e.id === "great-pyramid-giza")!;
    expect(giza.title).toBe("吉萨大金字塔");
    expect(giza.story!.chapters[0]!.heading).toBe("尼罗河畔的高原");
  });

  it("has tours whose stops all resolve to events", () => {
    const ids = new Set(getEvents().map((e) => e.id));
    for (const tour of getTours())
      for (const stop of tour.stops) expect(ids.has(stop.eventId)).toBe(true);
  });

  it("covers every year with exactly one era", () => {
    const eras = getEras();
    for (const y of [-3000, -1, 1, 476, 1000, 1453, 1789, 1914, 1945, 1991, 2026]) {
      expect(eraForYear(y, eras)).toBeDefined();
    }
  });

  it("picks the latest snapshot at or before a year", () => {
    expect(pickSnapshotYear(1950, SNAPSHOT_YEARS)).toBe(1945);
    expect(pickSnapshotYear(1914, SNAPSHOT_YEARS)).toBe(1914);
    expect(pickSnapshotYear(-3000, SNAPSHOT_YEARS)).toBe(-3000);
    expect(pickSnapshotYear(-1754, SNAPSHOT_YEARS)).toBe(-2000); // Hammurabi
    expect(pickSnapshotYear(1776, SNAPSHOT_YEARS)).toBe(1715);
    expect(pickSnapshotYear(1939, SNAPSHOT_YEARS)).toBe(1938);
    expect(pickSnapshotYear(2026, SNAPSHOT_YEARS)).toBe(2010);
  });
});

describe("data-load errors", () => {
  const failed = reducer(initialState, { type: "error", source: "snapshot", message: "404" });

  it("keeps a failure visible until that same load succeeds", () => {
    // The countries list usually lands after the (bigger) border file: it must not hide the failure.
    expect(reducer(failed, { type: "countriesLoaded", countries: [] }).error).not.toBeNull();
    expect(reducer(failed, { type: "snapshotLoaded", year: 1945, features: [] }).error).toBeNull();
  });

  it("clears every error and asks the fetch effects to run again on retry", () => {
    const s = reducer(reducer(failed, { type: "error", source: "countries", message: "500" }), {
      type: "retry",
    });
    expect(s.error).toBeNull();
    expect(s.retry).toBe(1);
  });
});
