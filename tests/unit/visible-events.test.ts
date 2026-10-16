import { describe, expect, it } from "vitest";
import { eventsHappening, headlineEvent, isVisibleAt } from "@/lib/domain/visible-events";
import type { HistoryEvent } from "@/lib/data/schemas";
import { getEventById } from "@/lib/data/loaders";

const base = getEventById("invasion-of-poland") as HistoryEvent; // 1939, importance 5
const ev = (over: Partial<HistoryEvent>): HistoryEvent => ({ ...base, ...over });

describe("isVisibleAt", () => {
  it("shows an event from just before it happens to a while after", () => {
    const e = ev({ year: 1939, endYear: undefined, importance: 5 });
    expect(isVisibleAt(e, 1937)).toBe(false);
    expect(isVisibleAt(e, 1938)).toBe(true);
    expect(isVisibleAt(e, 1939)).toBe(true);
    expect(isVisibleAt(e, 1947)).toBe(true);
    expect(isVisibleAt(e, 1948)).toBe(false);
  });

  it("keeps important events up longer than minor ones", () => {
    const major = ev({ year: 1939, endYear: undefined, importance: 5 });
    const minor = ev({ year: 1939, endYear: undefined, importance: 1 });
    expect(isVisibleAt(major, 1944)).toBe(true);
    expect(isVisibleAt(minor, 1944)).toBe(false);
  });

  it("stays visible through its whole span", () => {
    const e = ev({ year: 1939, endYear: 1945, importance: 1 });
    expect(isVisibleAt(e, 1943)).toBe(true);
  });
});

describe("eventsHappening / headlineEvent", () => {
  const a = ev({ id: "a", year: 1940, importance: 3 });
  const b = ev({ id: "b", year: 1941, importance: 5 });
  const c = ev({ id: "c", year: 1942, importance: 4 });

  it("excludes the previous year and includes the new one", () => {
    expect(eventsHappening([a, b, c], 1940, 1941).map((e) => e.id)).toEqual(["b"]);
  });

  it("works when scrubbing backwards", () => {
    expect(eventsHappening([a, b, c], 1942, 1940).map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("picks the most important event in the interval", () => {
    expect(headlineEvent([a, b, c], 1939, 1942)?.id).toBe("b");
    expect(headlineEvent([a, b, c], 1950, 1951)).toBeUndefined();
  });
});
