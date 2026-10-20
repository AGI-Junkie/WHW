/**
 * Where generated data lives under `public/`. Kept in one place so the fetch scripts, the loaders
 * and the tests agree. Snapshot years are the hour-cut subset of aourednik/historical-basemaps
 * (negative = BC; `-1` is the file `world_bc1.geojson`).
 */
export const SNAPSHOT_YEARS: readonly number[] = [
  -3000, -2000, -1500, -1000, -700, -500, -1, 400, 800, 1279, 1492, 1650, 1715, 1783, 1815, 1878,
  1914, 1920, 1938, 1945, 1994, 2010,
];

export const COUNTRIES_URL = "/data/countries.json";
export const SNAPSHOT_INDEX_URL = "/data/borders/index.json";

/** File name used both on disk (public/data/borders/) and by the upstream repo. */
export function snapshotFileName(year: number): string {
  if (year === 0) throw new Error("There is no year 0");
  return year < 0 ? `world_bc${-year}.geojson` : `world_${year}.geojson`;
}

export function snapshotUrl(year: number): string {
  return `/data/borders/${snapshotFileName(year)}`;
}

/**
 * Pinned commit of aourednik/historical-basemaps, so every build simplifies the same data. CI caches
 * the generated snapshots keyed on this file, so bumping the pin also refreshes the cache.
 */
export const UPSTREAM_SNAPSHOT_REF = "da7a4b735ecef70aebdc9c73e409d8a2500d50f3";

export const UPSTREAM_SNAPSHOT_BASE = `https://raw.githubusercontent.com/aourednik/historical-basemaps/${UPSTREAM_SNAPSHOT_REF}/geojson/`;
