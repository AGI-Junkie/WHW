import { NextResponse } from "next/server";
import { z } from "zod";
import type { WikiSummaryResponse } from "@/lib/data/schemas";
import { clientKey, createRateLimiter } from "@/lib/security/rate-limit";

/**
 * The app's only server code: a same-origin proxy for the Wikipedia REST summary endpoint.
 * Order: rate limit → Zod on the title and language → fixed upstream hosts → descriptive User-Agent
 * → 8 s timeout → only whitelisted fields go back, and the thumbnail host is checked against the CSP
 * allowlist. Titles are always English; for `lang=zh` the English page's interlanguage link picks
 * the Chinese article, and the English summary is the fallback when there is none.
 */
const TitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^<>{}|\\^[\]#]+$/, "title contains forbidden characters");
const LangSchema = z.enum(["en", "zh"]).catch("en");

const UpstreamSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  extract: z.string().optional(),
  thumbnail: z.object({ source: z.string() }).optional(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
});
const LangLinksSchema = z.object({
  query: z
    .object({
      pages: z.record(z.string(), z.object({ langlinks: z.array(z.object({ "*": z.string() })).optional() })),
    })
    .optional(),
});

const UA = process.env["WIKI_USER_AGENT"] ?? "WorldHistoryWeb/0.1 (https://github.com/haakram/WHW)";
const ALLOWED_IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const allow = createRateLimiter(120, 60_000);

function safeImage(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

function reply(body: WikiSummaryResponse, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    // Browsers keep a summary for an hour, the CDN for a day (and serves it stale while refreshing).
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
    },
  });
}

function upstream(url: string, lang: "en" | "zh"): Promise<Response> {
  return fetch(url, {
    // zh.wikipedia converts between script variants by Accept-Language; ask for Simplified.
    headers: { "User-Agent": UA, Accept: "application/json", ...(lang === "zh" ? { "Accept-Language": "zh-cn" } : {}) },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 86400 },
  });
}

/** The Chinese article linked from an English one, or null when there is none. */
async function zhTitle(enTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query", prop: "langlinks", lllang: "zh", redirects: "1", format: "json", titles: enTitle,
  });
  const res = await upstream(`https://en.wikipedia.org/w/api.php?${params}`, "en");
  if (!res.ok) return null;
  const pages = LangLinksSchema.parse(await res.json()).query?.pages ?? {};
  return Object.values(pages)[0]?.langlinks?.[0]?.["*"] ?? null;
}

async function summary(title: string, lang: "en" | "zh"): Promise<Response> {
  const host = lang === "zh" ? "zh.wikipedia.org" : "en.wikipedia.org";
  return upstream(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`, lang);
}

export async function GET(req: Request): Promise<NextResponse> {
  if (process.env["CONTENT_PROVIDER"] === "static") return reply({ ok: false, reason: "static-mode" });
  // Without a proxy there is no trustworthy client identity, and one shared bucket would lock everyone out.
  const key = clientKey(req.headers);
  if (key !== "direct" && !allow(key)) return reply({ ok: false, reason: "rate-limited" }, 429);
  const params = new URL(req.url).searchParams;
  const parsed = TitleSchema.safeParse(params.get("title"));
  if (!parsed.success) return reply({ ok: false, reason: "bad-title" }, 400);
  const lang = LangSchema.parse(params.get("lang"));
  const title = parsed.data;
  try {
    const zh = lang === "zh" ? await zhTitle(title) : null;
    let res = zh ? await summary(zh, "zh") : await summary(title, "en");
    if (zh && !res.ok) res = await summary(title, "en");
    if (res.status === 404) return reply({ ok: false, reason: "not-found" }, 404);
    if (!res.ok) return reply({ ok: false, reason: `upstream-${res.status}` }, 502);
    const data = UpstreamSchema.parse(await res.json());
    return reply({
      ok: true,
      title: data.title,
      description: data.description ?? null,
      extract: data.extract ?? "",
      thumbnailUrl: safeImage(data.thumbnail?.source),
      pageUrl: data.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "timeout" : "unavailable";
    return reply({ ok: false, reason }, 504);
  }
}
