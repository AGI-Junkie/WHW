import { describe, expect, it } from "vitest";
import { getEvents } from "@/lib/data/loaders";
import { MAX_YEAR, MIN_YEAR, type HistoryEvent } from "@/lib/data/schemas";
import { WORLD_REGIONS, worldAtYear } from "@/lib/domain/world-at-year";

const event = (id: string, patch: Partial<HistoryEvent> = {}): HistoryEvent => ({
  ...getEvents()[0]!,
  id,
  year: 1945,
  countryIso: "FR",
  ...patch,
});
const shown = (events: HistoryEvent[], year = 1945) =>
  worldAtYear(events, year).groups.flatMap((g) => g.events.map((e) => e.id));

describe("world at a year", () => {
  it("includes both edges of the time window and overlapping spans", () => {
    const events = [
      event("before", { year: 1938 }),
      event("left", { year: 1939 }),
      event("right", { year: 1951 }),
      event("after", { year: 1952 }),
      event("ongoing", { year: 1900, endYear: 1940, countryIso: "CN" }),
      event("ended", { year: 1900, endYear: 1938 }),
    ];
    expect(worldAtYear(events, 1945)).toMatchObject({ from: 1939, to: 1951 });
    expect(shown(events)).toEqual(["left", "right", "ongoing"]);
  });

  it("ranks by proximity, then significance, and caps each region at three", () => {
    const events = [
      event("distant", { year: 1951, importance: 5 }),
      event("minor", { year: 1944, importance: 1 }),
      event("major", { year: 1944, importance: 5 }),
      event("current", { importance: 1 }),
    ];
    expect(shown(events)).toEqual(["current", "major", "minor"]);
    expect(events.map((e) => e.id)).toEqual(["distant", "minor", "major", "current"]);
  });

  it("widens in antiquity, clamps at dataset bounds and skips year zero", () => {
    expect(worldAtYear([], MIN_YEAR)).toMatchObject({ from: MIN_YEAR, to: -2700 });
    expect(worldAtYear([], MAX_YEAR)).toMatchObject({ from: MAX_YEAR - 6, to: MAX_YEAR });
    expect(worldAtYear([], -1)).toMatchObject({ from: -151, to: 150 });
    expect(worldAtYear([], 1)).toMatchObject({ from: -120, to: 121 });
    expect(
      shown([event("last-bc", { year: -120 }), event("too-early", { year: -121 })], 1),
    ).toEqual(["last-bc"]);
  });

  it("groups locations and retains empty regions and unmapped events", () => {
    const codes = ["FR", "EG", "IQ", "IN", "CN", "US", "NZ", undefined];
    const events = codes.map((countryIso, i) => event(String(i), { countryIso }));
    const groups = worldAtYear(events, 1945).groups;
    expect(groups.map((g) => g.region)).toEqual(WORLD_REGIONS);
    expect(groups.map((g) => g.events.map((e) => e.id))).toEqual(codes.map((_, i) => [String(i)]));
    expect(shown([event("unmapped", { countryIso: "XX" })])).toEqual(["unmapped"]);
    expect(worldAtYear([], 1945).groups.every((g) => g.events.length === 0)).toBe(true);
  });

  it("maps every curated event with a location code to a named region", () => {
    for (const e of getEvents().filter((e) => e.countryIso)) {
      expect(
        worldAtYear([e], e.year).groups.find((g) => g.region === "Other locations")!.events,
        e.countryIso,
      ).toEqual([]);
    }
  });
});
