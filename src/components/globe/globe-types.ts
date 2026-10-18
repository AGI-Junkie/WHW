import type { BorderFeature } from "@/lib/data/schemas";
import type { GlobeArc, GlobePath } from "@/lib/domain/globe-shapes";

export type { GlobeArc, GlobePath };

/** A marker on the globe. `kind` decides the shape/legend; `color` and `radius` are final values. */
export interface GlobePin {
  id: string;
  kind: "event" | "country";
  lat: number;
  lng: number;
  /** CSS color string. */
  color: string;
  /** Degrees, react-globe.gl `pointRadius`. */
  radius: number;
  /** Tooltip text (plain, no HTML). */
  label: string;
  importance: number;
}

export interface GlobeRing {
  id: string;
  lat: number;
  lng: number;
  color: string;
  /** Degrees. */
  maxRadius: number;
}

export interface GlobeLatLng {
  lat: number;
  lng: number;
}

export interface GlobeCameraTarget {
  lat: number;
  lng: number;
  /** Globe radii above the surface; 2.5 shows a hemisphere, 0.6 is a country close-up. */
  altitude: number;
  /** Fly duration in ms; default 1200. */
  durationMs?: number;
}

export interface GlobeCanvasProps {
  polygons: BorderFeature[];
  /** Cap color for a polygon (stable per polity — see lib/domain/palette.ts). */
  polygonColor: (feature: BorderFeature) => string;
  pins: GlobePin[];
  arcs: GlobeArc[];
  rings: GlobeRing[];
  /** Optional surface lines drawn over the polygons (the compare-mode outlines). */
  paths?: GlobePath[];
  /** When this object identity changes, the camera flies to it. `null` leaves the camera alone. */
  cameraTarget: GlobeCameraTarget | null;
  autoRotate: boolean;
  onPinClick?: (pin: GlobePin) => void;
  /** Click handlers also get the clicked point on the globe. */
  onPolygonClick?: (feature: BorderFeature, at: GlobeLatLng) => void;
  onBackgroundClick?: (at: GlobeLatLng) => void;
}
