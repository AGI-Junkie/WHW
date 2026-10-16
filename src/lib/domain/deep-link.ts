import { YearSchema } from "@/lib/data/schemas";

/** What the URL hash carries so a view can be shared: `#y=1453&e=fall-of-constantinople&s=1`. */
export interface DeepLink {
  year?: number;
  eventId?: string;
  story?: boolean;
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseDeepLink(hash: string): DeepLink {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const out: DeepLink = {};
  const y = YearSchema.safeParse(Number(params.get("y")));
  if (params.has("y") && y.success) out.year = y.data;
  const e = params.get("e");
  if (e && ID.test(e) && e.length <= 120) out.eventId = e;
  if (out.eventId && params.get("s") === "1") out.story = true;
  return out;
}

export function buildDeepLink(link: DeepLink): string {
  const params = new URLSearchParams();
  if (link.year !== undefined) params.set("y", String(link.year));
  if (link.eventId) params.set("e", link.eventId);
  if (link.eventId && link.story) params.set("s", "1");
  const s = params.toString();
  return s ? `#${s}` : "";
}
