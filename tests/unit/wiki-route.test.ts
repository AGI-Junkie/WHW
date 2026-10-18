import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/wiki/summary/route";

const call = (qs: string, ip = "10.0.0.1") =>
  GET(new Request(`http://x/api/wiki/summary?${qs}`, { headers: { "x-real-ip": ip } }));
const upstream = (thumb?: string) =>
  Response.json({ title: "Rome", extract: "x", ...(thumb ? { thumbnail: { source: thumb } } : {}) });

beforeEach(() => vi.stubEnv("CONTENT_PROVIDER", "live"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/wiki/summary", () => {
  it("rejects titles with forbidden characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("title=%3Cscript%3E&lang=en")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits the 121st request from one client", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => upstream()));
    for (let i = 0; i < 120; i++) expect((await call("title=Rome", "10.0.0.2")).status).toBe(200);
    expect((await call("title=Rome", "10.0.0.2")).status).toBe(429);
  });

  it("drops thumbnails outside the Wikimedia hosts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => upstream("https://evil.example/x.jpg")));
    expect(await (await call("title=Rome", "10.0.0.3")).json()).toMatchObject({ ok: true, thumbnailUrl: null });
  });

  it("keeps Wikimedia thumbnails", async () => {
    const src = "https://upload.wikimedia.org/x.jpg";
    vi.stubGlobal("fetch", vi.fn(async () => upstream(src)));
    expect(await (await call("title=Rome", "10.0.0.4")).json()).toMatchObject({ thumbnailUrl: src });
  });

  it("falls back to the English summary when the Chinese article is missing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("w/api.php")) return Response.json({ query: { pages: { 1: { langlinks: [{ "*": "罗马" }] } } } });
      return url.includes("zh.wikipedia.org") ? new Response("", { status: 404 }) : upstream();
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("title=Rome&lang=zh", "10.0.0.5")).status).toBe(200);
    expect(fetchMock.mock.calls.map(([u]) => new URL(u as string).host)).toEqual([
      "en.wikipedia.org", "zh.wikipedia.org", "en.wikipedia.org",
    ]);
  });

  it("answers static-mode without touching the network", async () => {
    vi.stubEnv("CONTENT_PROVIDER", "static");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await call("title=Rome")).json()).toEqual({ ok: false, reason: "static-mode" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
