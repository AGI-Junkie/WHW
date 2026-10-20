import { describe, expect, it } from "vitest";
import { getEvents, getEventsIn } from "@/lib/data/loaders";
import { normalize, parseYearQuery, search } from "@/lib/domain/search";
import { buildDeepLink, parseDeepLink } from "@/lib/domain/deep-link";

describe("search", () => {
  it("parses years in several spellings and rejects year 0", () => {
    expect(parseYearQuery("1453")).toBe(1453);
    expect(parseYearQuery("500 BC")).toBe(-500);
    expect(parseYearQuery("AD 79")).toBe(79);
    expect(parseYearQuery("-44")).toBe(-44);
    expect(parseYearQuery("0")).toBeNull();
    expect(parseYearQuery("5000 BC")).toBeNull();
    expect(parseYearQuery("rome")).toBeNull();
  });

  it("strips accents", () => {
    expect(normalize("Kraków")).toBe("krakow");
  });

  it("ranks title matches first and offers a jump-to-year", () => {
    const events = getEvents();
    expect(search("constantinople", events, [])[0]).toMatchObject({ kind: "event" });
    const r = search("1453", events, []);
    expect(r[0]).toMatchObject({ kind: "year", year: 1453 });
    expect(r.some((x) => x.kind === "event" && x.event.id === "fall-of-constantinople")).toBe(true);
    expect(search("", events, [])).toEqual([]);
  });

  it("finds Chinese titles, and English ones too when given the English titles", () => {
    const zh = getEventsIn("zh");
    const first = (q: string, alt?: Map<string, string>) => {
      const r = search(q, zh, [], 12, alt).find((x) => x.kind === "event");
      return r?.kind === "event" ? r.event : undefined;
    };
    expect(first("君士坦丁堡陷落")?.id).toBe("fall-of-constantinople");
    expect(first("waterloo")).toBeUndefined();
    const english = new Map(getEvents().map((e) => [e.id, e.title]));
    expect(first("waterloo", english)).toMatchObject({
      id: "battle-of-waterloo",
      title: "滑铁卢战役",
    });
  });
});

describe("deep links", () => {
  it("round-trips year, event and story", () => {
    const link = { year: -44, eventId: "assassination-of-caesar", story: true };
    expect(parseDeepLink(buildDeepLink(link))).toEqual(link);
    expect(buildDeepLink({ year: 1950 })).toBe("#y=1950");
  });

  it("round-trips the category filter and drops unknown categories", () => {
    const link = { year: 1942, hidden: ["war" as const, "disaster" as const] };
    expect(buildDeepLink(link)).toBe("#y=1942&hide=war,disaster");
    expect(parseDeepLink(buildDeepLink(link))).toEqual(link);
    expect(parseDeepLink("#hide=war,<b>,war,nope")).toEqual({ hidden: ["war"] });
  });

  it("ignores invalid values", () => {
    expect(parseDeepLink("#y=0&e=<script>&s=1")).toEqual({});
    expect(parseDeepLink("#y=99999")).toEqual({});
    expect(parseDeepLink("#s=1")).toEqual({});
  });
});
