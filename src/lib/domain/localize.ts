import type { EventZh, HistoryEvent } from "@/lib/data/schemas";

/** An event with its translated texts swapped in. Places, years and the camera path stay the English ones. */
export function localizeEvent(e: HistoryEvent, zh: EventZh | undefined): HistoryEvent {
  if (!zh) return e;
  const out: HistoryEvent = { ...e, title: zh.title, summary: zh.summary ?? e.summary };
  const s = e.story;
  const z = zh.story;
  if (s && z) {
    out.story = {
      ...s,
      tagline: z.tagline,
      facts: z.facts.length === s.facts.length ? z.facts : s.facts,
      chapters: s.chapters.map((c, i) => ({ ...c, ...z.chapters[i] })),
      ...(z.quote ? { quote: z.quote } : {}),
      ...(z.legacy ? { legacy: z.legacy } : {}),
    };
  }
  return out;
}
