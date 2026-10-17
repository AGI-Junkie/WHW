import type { BorderFeature } from "@/lib/data/schemas";

/** Structurally the globe's GlobePath; declared here because lib/domain may not import components. */
export interface OutlinePath {
  id: string;
  points: number[][];
  color: string;
}

/** Every outer and inner ring of a snapshot as a surface line, for the compare overlay. */
export function featureOutlines(features: readonly BorderFeature[], color: string): OutlinePath[] {
  const out: OutlinePath[] = [];
  features.forEach((f, i) => {
    const coords = f.geometry.coordinates as number[][][] | number[][][][];
    const rings = (f.geometry.type === "MultiPolygon" ? (coords as number[][][][]).flat(1) : coords) as number[][][];
    rings.forEach((ring, j) => {
      if (ring.length > 1) out.push({ id: `${i}:${j}`, points: ring, color });
    });
  });
  return out;
}
