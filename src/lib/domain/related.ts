import type { HistoryEvent, Tour } from "@/lib/data/schemas";

/**
 * Events worth reading next: the same place, the same theme close in time, the same belligerents,
 * or a shared story tour. Scored, not filtered, so every event gets a few suggestions.
 */
export function relatedEvents(
  e: HistoryEvent,
  events: readonly HistoryEvent[],
  tours: readonly Tour[] = [],
  limit = 5,
): HistoryEvent[] {
  const tourMates = new Set<string>();
  for (const t of tours) {
    if (t.stops.some((s) => s.eventId === e.id)) for (const s of t.stops) tourMates.add(s.eventId);
  }
  const sides = new Set((e.belligerents ?? []).map((b) => b.name));
  const scored = events
    .filter((x) => x.id !== e.id)
    .map((x) => {
      const gap = Math.abs(x.year - e.year);
      let score = 0;
      if (e.countryIso && x.countryIso === e.countryIso) score += 3;
      if (x.category === e.category) score += 1;
      if (gap <= 50) score += 2;
      else if (gap <= 200) score += 1;
      if ((x.belligerents ?? []).some((b) => sides.has(b.name))) score += 2;
      if (tourMates.has(x.id)) score += 2;
      return { x, score, gap };
    })
    .filter((s) => s.score >= 3);
  scored.sort((p, q) => q.score - p.score || p.gap - q.gap || q.x.importance - p.x.importance);
  return scored.slice(0, limit).map((s) => s.x);
}
