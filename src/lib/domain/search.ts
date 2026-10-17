import type { Country, HistoryEvent } from "@/lib/data/schemas";
import { MAX_YEAR, MIN_YEAR } from "@/lib/data/schemas";

export type SearchResult =
  | { kind: "year"; year: number; score: number }
  | { kind: "event"; event: HistoryEvent; score: number }
  | { kind: "country"; country: Country; score: number };

/** Lower-case, accents stripped: "Kraków" matches "krakow". */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "1453", "500 BC", "AD 79", "-44", "公元前500年", "1453年" → a calendar year (never 0), or null. */
export function parseYearQuery(q: string): number | null {
  const zh = normalize(q).replace(/年$/, "").replace(/^(?:公元前|前)\s*(\d+)$/, "$1 bc").replace(/^公元\s*(\d+)$/, "$1");
  const m = zh.match(/^(ad\s*)?(-?\d{1,4})\s*(bc|bce|ad|ce)?$/);
  if (!m) return null;
  let year = Number(m[2]);
  if (m[3] === "bc" || m[3] === "bce") year = -Math.abs(year);
  if (year === 0 || year < MIN_YEAR || year > MAX_YEAR) return null;
  return year;
}

function textScore(hay: string, q: string): number {
  if (hay === q) return 120;
  if (hay.startsWith(q)) return 100;
  if (hay.split(/[\s\-–,'’()]+/).some((w) => w.startsWith(q))) return 70;
  if (hay.includes(q)) return 45;
  return 0;
}

/** Ranked matches across events (title, summary, place) and countries, plus a jump-to-year. */
export function search(
  query: string,
  events: readonly HistoryEvent[],
  countries: readonly Country[],
  limit = 12,
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const out: SearchResult[] = [];
  const year = parseYearQuery(query);
  if (year !== null) out.push({ kind: "year", year, score: 1000 });

  for (const event of events) {
    let s = textScore(normalize(event.title), q);
    if (!s && q.length >= 3) {
      if (normalize(event.summary).includes(q)) s = 20;
      else if ((event.belligerents ?? []).some((b) => normalize(b.name).includes(q))) s = 25;
    }
    if (year !== null && event.year === year) s = Math.max(s, 90);
    if (s) out.push({ kind: "event", event, score: s + event.importance * 2 + (event.story ? 3 : 0) });
  }
  for (const country of countries) {
    const s = textScore(normalize(country.name), q);
    if (s) out.push({ kind: "country", country, score: s - 5 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
