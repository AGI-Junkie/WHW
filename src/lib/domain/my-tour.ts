import type { HistoryEvent, Tour } from "@/lib/data/schemas";

/** The id the reducer and the URL use for the visitor's own tour. */
export const MY_TOUR_ID = "mine";
/** A tour opened from a `#t=` link: played as is, never written over the visitor's own tour. */
export const SHARED_TOUR_ID = "shared";
export const MY_TOUR_MAX = 14;

/** The visitor's picked events as a tour, in time order; the event summaries narrate the stops. */
export function buildMyTour(
  ids: readonly string[],
  events: readonly HistoryEvent[],
  id = MY_TOUR_ID,
): Tour | null {
  const picked = ids
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is HistoryEvent => e !== undefined)
    .sort((a, b) => a.year - b.year);
  if (picked.length === 0) return null;
  return {
    id,
    title: "My tour",
    subtitle: `${picked.length} events picked by you`,
    from: picked[0]!.year,
    to: picked[picked.length - 1]!.year,
    stops: picked.map((e) => ({ eventId: e.id, narration: e.summary, altitude: 1.2 })),
  };
}

export function toggleMyTour(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= MY_TOUR_MAX ? [...ids] : [...ids, id];
}
