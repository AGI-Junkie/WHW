import type { HistoryEvent } from "@/lib/data/schemas";

export const QUIZ_ROUNDS = 5;
const EARTH_RADIUS_KM = 6371;
/** A guess this far off (or further) scores nothing; a perfect pin scores 1000. */
const ZERO_SCORE_KM = 4000;

/** Great-circle distance (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function quizPoints(km: number): number {
  return Math.max(0, Math.round(1000 * (1 - km / ZERO_SCORE_KM)));
}

/** A well-known event not asked yet in this game; deterministic for a seed so it can be tested. */
export function pickQuizEvent(events: readonly HistoryEvent[], seed: number, asked: readonly string[]): HistoryEvent | undefined {
  const pool = events.filter((e) => e.importance >= 4 && !asked.includes(e.id));
  return pool[Math.abs(Math.floor(seed)) % Math.max(1, pool.length)];
}
