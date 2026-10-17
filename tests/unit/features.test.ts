import { describe, expect, it } from "vitest";
import { getEvents } from "@/lib/data/loaders";
import { initialState, reducer } from "@/lib/store/reducer";
import { distanceKm, QUIZ_ROUNDS, quizPoints } from "@/lib/domain/quiz";
import { buildMyTour, MY_TOUR_ID, MY_TOUR_MAX, toggleMyTour } from "@/lib/domain/my-tour";
import { buildDeepLink, parseDeepLink } from "@/lib/domain/deep-link";
import { parseYearQuery } from "@/lib/domain/search";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { featureOutlines } from "@/lib/domain/compare";

describe("quiz", () => {
  it("measures great-circle distance and scores it", () => {
    expect(distanceKm({ lat: 51.5, lng: -0.13 }, { lat: 48.86, lng: 2.35 })).toBeCloseTo(343, -1); // London–Paris
    expect(quizPoints(0)).toBe(1000);
    expect(quizPoints(2000)).toBe(500);
    expect(quizPoints(10_000)).toBe(0);
  });

  it("plays five rounds without repeating an event, and a second guess changes nothing", () => {
    let s = reducer(initialState, { type: "quizStart", seed: 7 });
    expect(s.quiz?.round).toBe(1);
    const first = getEvents().find((e) => e.id === s.quiz!.eventId)!;
    expect(s.year).toBe(first.year);
    s = reducer(s, { type: "quizGuess", lat: first.lat, lng: first.lng });
    expect(s.quiz?.points).toBe(1000);
    expect(reducer(s, { type: "quizGuess", lat: 0, lng: 0 })).toBe(s);
    for (let r = 2; r <= QUIZ_ROUNDS; r++) {
      s = reducer(s, { type: "quizNext", seed: r * 13 });
      expect(s.quiz?.round).toBe(r);
      s = reducer(s, { type: "quizGuess", lat: 0, lng: 0 });
    }
    expect(new Set(s.quiz!.asked).size).toBe(QUIZ_ROUNDS);
    s = reducer(s, { type: "quizNext", seed: 1 });
    expect(s.quiz?.done).toBe(true);
    expect(reducer(s, { type: "quizEnd" }).quiz).toBeNull();
  });

  it("cannot skip a round without guessing", () => {
    const s = reducer(initialState, { type: "quizStart", seed: 3 });
    expect(reducer(s, { type: "quizNext", seed: 4 })).toBe(s);
  });
});

describe("my tour", () => {
  const [a, b, c] = [...getEvents()].sort((x, y) => y.year - x.year);

  it("orders stops by year and caps the list", () => {
    const tour = buildMyTour([a!.id, c!.id, b!.id], getEvents())!;
    expect(tour.stops.map((s) => s.eventId)).toEqual([c!.id, b!.id, a!.id]);
    expect(buildMyTour([], getEvents())).toBeNull();
    const many = getEvents().slice(0, MY_TOUR_MAX + 3).reduce<string[]>((ids, e) => toggleMyTour(ids, e.id), []);
    expect(many).toHaveLength(MY_TOUR_MAX);
    expect(toggleMyTour(many, many[0]!)).toHaveLength(MY_TOUR_MAX - 1);
  });

  it("runs through the reducer like a curated tour", () => {
    let s = reducer(initialState, { type: "toggleMyTour", id: a!.id });
    s = reducer(s, { type: "toggleMyTour", id: b!.id });
    s = reducer(s, { type: "startTour", id: MY_TOUR_ID });
    expect(s.tour).toEqual({ id: MY_TOUR_ID, stop: 0 });
    expect(s.selection).toEqual({ kind: "event", id: b!.id });
    s = reducer(reducer(s, { type: "tourStep", delta: 1 }), { type: "tourStep", delta: 1 });
    expect(s.tour).toBeNull();
    expect(s.discovery.toursCompleted).toContain(MY_TOUR_ID);
  });

  it("round-trips through the URL hash and rejects junk ids", () => {
    const hash = buildDeepLink({ tour: ["fall-of-constantinople", "moon-landing"] });
    expect(parseDeepLink(hash).tour).toEqual(["fall-of-constantinople", "moon-landing"]);
    expect(parseDeepLink("#t=ok-id,<script>,Bad_Id").tour).toEqual(["ok-id"]);
    expect(parseDeepLink("#y=1453").tour).toBeUndefined();
  });
});

describe("search years in Chinese", () => {
  it("parses 公元前 and 年", () => {
    expect(parseYearQuery("公元前500年")).toBe(-500);
    expect(parseYearQuery("前44")).toBe(-44);
    expect(parseYearQuery("1453年")).toBe(1453);
    expect(parseYearQuery("公元79年")).toBe(79);
    expect(parseYearQuery("500 BC")).toBe(-500);
  });
});

describe("rate limiter", () => {
  it("allows the limit per window, then blocks until the window resets", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow("ip", 0), allow("ip", 1), allow("ip", 2)]).toEqual([true, true, false]);
    expect(allow("other", 2)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });
});

describe("compare outlines", () => {
  it("turns polygons and multipolygons into one path per ring", () => {
    const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
    const paths = featureOutlines(
      [
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring, ring] } },
        { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [[ring], [ring]] } },
      ],
      "#000",
    );
    expect(paths).toHaveLength(4);
    expect(paths[0]!.points).toBe(ring);
  });
});
