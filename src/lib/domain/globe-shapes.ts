/** Shapes shared by the domain builders and the globe component (lib/domain may not import components). */
export interface GlobeArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** Solid color, or a [from, to] gradient. */
  color: string | [string, string];
  label?: string;
}

/** A line on the surface, e.g. a border outline; `points` are GeoJSON [lng, lat] pairs. */
export interface GlobePath {
  id: string;
  points: number[][];
  color: string;
}
