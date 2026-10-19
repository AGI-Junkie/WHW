import { describe, expect, it } from "vitest";
import { getEras, getEvents, getTours } from "@/lib/data/loaders";
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

  it("has tours whose stops all resolve to events", () => {
    const ids = new Set(getEvents().map((e) => e.id));
    for (const tour of getTours()) for (const stop of tour.stops) expect(ids.has(stop.eventId)).toBe(true);
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
    expect(pickSnapshotYear(-3000, SNAPSHOT_YEARS)).toBe(-500);
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
