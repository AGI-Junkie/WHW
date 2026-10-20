import { z } from "zod";

/**
 * Data contracts for every JSON the app loads. Curated files in `src/data/` and generated files in
 * `public/data/` are parsed through these at load time, so a bad row fails loudly instead of
 * rendering as an empty pin (AI_RULES R8.3).
 */

export const MIN_YEAR = -3000;
export const MAX_YEAR = 2026;

/** Astronomical-free convention: negative = BC, positive = AD, there is no year 0. */
export const YearSchema = z
  .number()
  .int()
  .min(MIN_YEAR)
  .max(MAX_YEAR)
  .refine((y) => y !== 0, { message: "There is no year 0 — use -1 for 1 BC and 1 for AD 1" });

export const LatSchema = z.number().min(-90).max(90);
export const LngSchema = z.number().min(-180).max(180);

export const CategorySchema = z.enum([
  "war",
  "politics",
  "science",
  "culture",
  "exploration",
  "disaster",
  "economy",
  "religion",
]);
export type Category = z.infer<typeof CategorySchema>;

export const BelligerentSchema = z.object({
  name: z.string().min(1).max(80),
  lat: LatSchema,
  lng: LngSchema,
  /** "a" and "b" are the two sides of the conflict; arcs are drawn between the sides. */
  side: z.enum(["a", "b"]),
});
export type Belligerent = z.infer<typeof BelligerentSchema>;

/** One beat of an immersive story: the camera flies to (lat, lng, altitude) while the text plays. */
export const StoryChapterSchema = z.object({
  /** Short date or time label, e.g. "29 May 1453" or "08:15". */
  when: z.string().min(1).max(40),
  heading: z.string().min(2).max(80),
  text: z.string().min(20).max(420),
  lat: LatSchema,
  lng: LngSchema,
  altitude: z.number().min(0.3).max(4),
});
export type StoryChapter = z.infer<typeof StoryChapterSchema>;

/** Optional long-form content for world-shaping events, shown in the immersive story view. */
export const StorySchema = z.object({
  tagline: z.string().min(10).max(140),
  /** A real, attributed quotation; `by` names the speaker or document and, where known, the date. */
  quote: z.object({ text: z.string().min(3).max(240), by: z.string().min(3).max(160) }).optional(),
  facts: z
    .array(z.object({ label: z.string().min(1).max(40), value: z.string().min(1).max(80) }))
    .min(2)
    .max(6),
  chapters: z.array(StoryChapterSchema).min(2).max(8),
  /** What it led to, one or two sentences. */
  legacy: z.string().min(20).max(300).optional(),
});
export type Story = z.infer<typeof StorySchema>;

export const HistoryEventSchema = z
  .object({
    /** kebab-case, unique, stable — tours reference it. e.g. "fall-of-constantinople" */
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3).max(120),
    year: YearSchema,
    /** Only for spans (wars, eras of a dynasty). Must be ≥ year. */
    endYear: YearSchema.optional(),
    lat: LatSchema,
    lng: LngSchema,
    /** ISO 3166-1 alpha-2 of the modern country at that location, when meaningful. */
    countryIso: z.string().length(2).toUpperCase().optional(),
    category: CategorySchema,
    /** 1 = local footnote … 5 = world-shaping. Drives pin size, play-mode pulse and the Follow toggle. */
    importance: z.number().int().min(1).max(5),
    /** Own words, 2–3 sentences, no copied Wikipedia text. */
    summary: z.string().min(40).max(700),
    /** Exact English Wikipedia article title; the proxy fetches its live summary + thumbnail. */
    wikipediaTitle: z.string().min(1).max(200),
    /** Wikimedia Commons file title ("File:….webm"). Resolved once by scripts/resolve-videos.ts. */
    commonsVideo: z
      .string()
      .regex(/^File:.+/)
      .optional(),
    /** Direct playable derivative on upload.wikimedia.org (written by the resolve script). */
    videoUrl: z.url().startsWith("https://upload.wikimedia.org/").optional(),
    /** License/author line shown under the player, e.g. "NASA · Public domain". */
    videoCredit: z.string().max(160).optional(),
    belligerents: z.array(BelligerentSchema).min(2).optional(),
    /** Hand-written chapters, quote and facts for the immersive view (see StorySchema). */
    story: StorySchema.optional(),
    /** At least one URL the curated summary can be checked against. */
    sources: z.array(z.url()).min(1),
  })
  .refine((e) => e.endYear === undefined || e.endYear >= e.year, {
    message: "endYear must be ≥ year",
  });
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export const HistoryEventsSchema = z.array(HistoryEventSchema);

/**
 * Simplified-Chinese text for an event, keyed by event id in src/data/events-zh.json. Every field is
 * optional except the title; whatever is missing falls back to the English. Chapters line up with the
 * English chapters by index, so the camera positions stay in events.json.
 */
export const EventZhSchema = z.object({
  title: z.string().min(2).max(60),
  summary: z.string().min(20).max(400).optional(),
  story: z
    .object({
      tagline: z.string().min(5).max(100),
      quote: z
        .object({ text: z.string().min(3).max(200), by: z.string().min(3).max(120) })
        .optional(),
      facts: z.array(
        z.object({ label: z.string().min(1).max(20), value: z.string().min(1).max(60) }),
      ),
      chapters: z.array(
        z.object({
          when: z.string().min(1).max(30),
          heading: z.string().min(2).max(40),
          text: z.string().min(10).max(300),
        }),
      ),
      legacy: z.string().min(10).max(200).optional(),
    })
    .optional(),
});
export type EventZh = z.infer<typeof EventZhSchema>;
export const EventsZhSchema = z.record(z.string(), EventZhSchema);

export const TourStopSchema = z.object({
  eventId: z.string(),
  /** One or two sentences spoken/shown at this stop. */
  narration: z.string().min(20).max(400),
  /** Camera distance in globe radii (react-globe.gl `altitude`). 0.6 = close, 2.5 = whole hemisphere. */
  altitude: z.number().min(0.3).max(4).default(1.2),
});
export type TourStop = z.infer<typeof TourStopSchema>;

export const TourSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(3).max(80),
  subtitle: z.string().min(10).max(200),
  /** Year range the tour spans; the timeline jumps to each stop's event year. */
  from: YearSchema,
  to: YearSchema,
  stops: z.array(TourStopSchema).min(3).max(14),
});
export type Tour = z.infer<typeof TourSchema>;
export const ToursSchema = z.array(TourSchema);

export const EraSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(3).max(60),
  from: YearSchema,
  /** Exclusive upper bound, except the last era which ends at MAX_YEAR inclusive. */
  to: YearSchema,
  /** CSS color token name from globals.css, e.g. "era-bronze". */
  tone: z.string().min(1),
});
export type Era = z.infer<typeof EraSchema>;
export const ErasSchema = z.array(EraSchema);

/** One row per current sovereign state, generated by scripts/fetch-countries.ts from Wikidata. */
export const CountrySchema = z.object({
  iso2: z.string().length(2),
  qid: z.string().regex(/^Q\d+$/),
  name: z.string().min(1),
  /** Wikidata P571 (inception) as a year; null when Wikidata has none. */
  inceptionYear: YearSchema.nullable(),
  capital: z.string().nullable(),
  lat: LatSchema,
  lng: LngSchema,
  /** Direct image URL on upload.wikimedia.org (or commons Special:FilePath), null if none. */
  flagUrl: z.url().nullable(),
  population: z.number().int().nonnegative().nullable(),
  /** English Wikipedia title for the live summary, usually "History of <name>". */
  wikipediaTitle: z.string().min(1),
});
export type Country = z.infer<typeof CountrySchema>;
export const CountriesSchema = z.array(CountrySchema);

/** Properties carried by every polygon in the historical-basemaps snapshots. */
export const BorderPropertiesSchema = z.object({
  NAME: z.string().nullable().optional(),
  ABBREVN: z.string().nullable().optional(),
  SUBJECTO: z.string().nullable().optional(),
  PARTOF: z.string().nullable().optional(),
  BORDERPRECISION: z.number().nullable().optional(),
});
export type BorderProperties = z.infer<typeof BorderPropertiesSchema>;

export const BorderFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: BorderPropertiesSchema,
  geometry: z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.any(),
  }),
});
export type BorderFeature = z.infer<typeof BorderFeatureSchema>;

export const BorderSnapshotSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(BorderFeatureSchema),
});
export type BorderSnapshot = z.infer<typeof BorderSnapshotSchema>;

/** public/data/borders/index.json — which snapshot years exist on disk (negative = BC). */
export const SnapshotIndexSchema = z.object({ years: z.array(YearSchema).min(1) });
export type SnapshotIndex = z.infer<typeof SnapshotIndexSchema>;

/** Shape returned by GET /api/wiki/summary — only whitelisted fields ever reach the browser. */
export const WikiSummarySchema = z.object({
  ok: z.literal(true),
  title: z.string(),
  description: z.string().nullable(),
  extract: z.string(),
  thumbnailUrl: z.url().nullable(),
  pageUrl: z.url(),
});
export type WikiSummary = z.infer<typeof WikiSummarySchema>;
export const WikiSummaryFailureSchema = z.object({ ok: z.literal(false), reason: z.string() });
export const WikiSummaryResponseSchema = z.union([WikiSummarySchema, WikiSummaryFailureSchema]);
export type WikiSummaryResponse = z.infer<typeof WikiSummaryResponseSchema>;
