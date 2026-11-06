import { MAX_YEAR, MIN_YEAR, type HistoryEvent } from "@/lib/data/schemas";
import { playStep } from "./time-scale";

// shortcut: groups follow modern location codes; extend these lists when curating a new location.
const REGION_CODES = [
  ["Europe", "AT BA BE BY CH CZ DE ES FR GB GR IE IT NL PL PT RU SE UA"],
  ["Africa", "CD DZ EG ET GH ML NG RW SD TN TZ ZA ZW"],
  ["West & Central Asia", "CY IL IQ IR KZ LB SA SY TR UZ"],
  ["South Asia", "BD IN PK"],
  ["East & Southeast Asia", "CN HK ID JP KH KR MN PH SG VN"],
  ["Americas", "AR BO BR BS CA CL CO CU GT HT MX PA PE US"],
  ["Oceania", "AU FJ NZ PG SB WS"],
  ["Other locations", ""],
] as const;

export const WORLD_REGIONS = REGION_CODES.map(([name]) => name);
const regionsByCode = new Map(
  REGION_CODES.flatMap(([name, codes]) =>
    codes
      .split(" ")
      .filter(Boolean)
      .map((code) => [code, name]),
  ),
);

/** Consecutive year numbers for distance calculations: 1 BC → 0, AD 1 → 1. */
const ordinal = (year: number) => (year < 0 ? year + 1 : year);
const calendarYear = (year: number) => (year <= 0 ? year - 1 : year);

/** Up to three nearby or ongoing events per region, closest first, then most significant. */
export function worldAtYear(events: readonly HistoryEvent[], year: number) {
  const radius = playStep(year) * 6;
  const from = Math.max(MIN_YEAR, calendarYear(ordinal(year) - radius));
  const to = Math.min(MAX_YEAR, calendarYear(ordinal(year) + radius));
  const distance = (e: HistoryEvent) =>
    Math.max(ordinal(e.year) - ordinal(year), ordinal(year) - ordinal(e.endYear ?? e.year), 0);
  const nearby = events
    .filter((e) => e.year <= to && (e.endYear ?? e.year) >= from)
    .sort(
      (a, b) =>
        distance(a) - distance(b) ||
        b.importance - a.importance ||
        a.year - b.year ||
        a.id.localeCompare(b.id),
    );
  return {
    from,
    to,
    groups: WORLD_REGIONS.map((region) => ({
      region,
      events: nearby
        .filter((e) => (regionsByCode.get(e.countryIso ?? "") ?? "Other locations") === region)
        .slice(0, 3),
    })),
  };
}
