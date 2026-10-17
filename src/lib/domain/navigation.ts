import type { Category, HistoryEvent } from "@/lib/data/schemas";

const byTime = (a: HistoryEvent, b: HistoryEvent) => a.year - b.year || a.id.localeCompare(b.id);

/**
 * The event before or after the current position in time. With a selected event the order is
 * (year, id), so events of the same year are all reachable; without one it is the first event
 * strictly after (or before) `year`.
 */
export function adjacentEvent(
  events: readonly HistoryEvent[],
  year: number,
  selectedId: string | null,
  direction: 1 | -1,
  hidden: readonly Category[] = [],
): HistoryEvent | undefined {
  const list = events.filter((e) => !hidden.includes(e.category)).sort(byTime);
  const idx = selectedId ? list.findIndex((e) => e.id === selectedId) : -1;
  if (idx >= 0) return list[idx + direction];
  return direction === 1 ? list.find((e) => e.year > year) : [...list].reverse().find((e) => e.year < year);
}
