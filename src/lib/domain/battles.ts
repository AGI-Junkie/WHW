import type { HistoryEvent } from "@/lib/data/schemas";
import type { GlobeArc } from "@/lib/domain/globe-shapes";
import { ARC_COLORS } from "@/lib/domain/palette";

const MAX_ARCS_PER_EVENT = 8;

/** Arcs between the two sides of every conflict that is under way in `year`. */
export function battleArcs(events: readonly HistoryEvent[], year: number): GlobeArc[] {
  const arcs: GlobeArc[] = [];
  for (const e of events) {
    if (!e.belligerents) continue;
    const end = e.endYear ?? e.year;
    if (year < e.year || year > end) continue;
    const a = e.belligerents.filter((b) => b.side === "a");
    const b = e.belligerents.filter((b) => b.side === "b");
    let n = 0;
    for (const x of a) {
      for (const y of b) {
        if (n++ >= MAX_ARCS_PER_EVENT) break;
        arcs.push({
          id: `${e.id}:${x.name}->${y.name}`,
          startLat: x.lat,
          startLng: x.lng,
          endLat: y.lat,
          endLng: y.lng,
          color: ARC_COLORS,
          label: `${e.title}: ${x.name} vs ${y.name}`,
        });
      }
    }
  }
  return arcs;
}
