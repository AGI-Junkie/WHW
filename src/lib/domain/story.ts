import type { HistoryEvent, Story, StoryChapter } from "@/lib/data/schemas";
import { formatYear, playStep } from "@/lib/domain/time-scale";

export interface ResolvedStory extends Story {
  eventId: string;
  /** True when the chapters were written by hand in events.json, false when built from the summary. */
  curated: boolean;
}

const MAX_ELSEWHERE = 3;

function sideNames(e: HistoryEvent, side: "a" | "b"): string[] {
  return (e.belligerents ?? []).filter((b) => b.side === side).map((b) => b.name);
}

function midpoint(e: HistoryEvent): { lat: number; lng: number } {
  const bs = e.belligerents ?? [];
  if (bs.length === 0) return { lat: e.lat, lng: e.lng };
  return {
    lat: bs.reduce((s, b) => s + b.lat, 0) / bs.length,
    lng: bs.reduce((s, b) => s + b.lng, 0) / bs.length,
  };
}

/** Other important events in the same stretch of time, for a "meanwhile" chapter. */
export function contemporaries(e: HistoryEvent, events: readonly HistoryEvent[]): HistoryEvent[] {
  const window = playStep(e.year) * 6;
  return events
    .filter((x) => x.id !== e.id && Math.abs(x.year - e.year) <= window && x.importance >= 3)
    .sort((a, b) => b.importance - a.importance || Math.abs(a.year - e.year) - Math.abs(b.year - e.year))
    .slice(0, MAX_ELSEWHERE);
}

/**
 * The story the immersive view plays for an event: its hand-written chapters when it has them,
 * otherwise a short story assembled from the summary, the two sides of a war and what else was
 * happening in the world at the time. Pure, so the reducer can compute camera targets from it.
 */
export function storyFor(e: HistoryEvent, events: readonly HistoryEvent[]): ResolvedStory {
  if (e.story) return { ...e.story, eventId: e.id, curated: true };

  const when = e.endYear ? `${formatYear(e.year)} – ${formatYear(e.endYear)}` : formatYear(e.year);
  const chapters: StoryChapter[] = [
    { when, heading: e.title, text: e.summary, lat: e.lat, lng: e.lng, altitude: 0.9 },
  ];
  const a = sideNames(e, "a");
  const b = sideNames(e, "b");
  if (a.length && b.length) {
    const m = midpoint(e);
    chapters.push({
      when,
      heading: "The two sides",
      text: `${a.join(", ")} against ${b.join(", ")}. The arcs on the globe join the capitals of each side.`,
      lat: m.lat,
      lng: m.lng,
      altitude: 2.2,
    });
  }
  const others = contemporaries(e, events);
  if (others.length) {
    chapters.push({
      when: `Around ${formatYear(e.year)}`,
      heading: "Meanwhile, elsewhere",
      text: others.map((o) => `${o.title} (${formatYear(o.year)})`).join(" · "),
      lat: e.lat,
      lng: e.lng,
      altitude: 2.8,
    });
  }
  if (chapters.length < 2) {
    chapters.push({ when, heading: "The wider view", text: e.summary, lat: e.lat, lng: e.lng, altitude: 2.4 });
  }

  const facts = [
    { label: e.endYear ? "Span" : "Year", value: when },
    { label: "Theme", value: e.category },
    { label: "Significance", value: `${"★".repeat(e.importance)}${"☆".repeat(5 - e.importance)}` },
  ];
  if (e.belligerents) facts.push({ label: "Belligerents", value: String(e.belligerents.length) });

  return {
    eventId: e.id,
    curated: false,
    tagline: e.summary.split(/(?<=\.)\s/)[0] ?? e.summary,
    facts,
    chapters,
  };
}

/** How long autoplay lingers on a chapter: long enough to read it. */
export function chapterDurationMs(chapter: StoryChapter): number {
  return Math.min(16000, Math.max(6000, 3000 + chapter.text.length * 45));
}
