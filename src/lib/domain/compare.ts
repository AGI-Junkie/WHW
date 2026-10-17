import type { BorderFeature } from "@/lib/data/schemas";
import type { GlobePath } from "@/lib/domain/globe-shapes";

/** Every outer and inner ring of a snapshot as a surface line, for the compare overlay. */
export function featureOutlines(features: readonly BorderFeature[], color: string): GlobePath[] {
  const out: GlobePath[] = [];
  features.forEach((f, i) => {
    const coords = f.geometry.coordinates as number[][][] | number[][][][];
    const rings = (f.geometry.type === "MultiPolygon" ? (coords as number[][][][]).flat(1) : coords) as number[][][];
    rings.forEach((ring, j) => {
      if (ring.length > 1) out.push({ id: `${i}:${j}`, points: ring, color });
    });
  });
  return out;
}
