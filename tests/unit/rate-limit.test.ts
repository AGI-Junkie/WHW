import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/security/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const rl = createRateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => rl.hit("ip", 0))).toEqual([true, true, true, false]);
  });

  it("tracks clients independently and resets after the window", () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 500)).toBe(false);
    expect(rl.hit("b", 500)).toBe(true);
    expect(rl.hit("a", 1000)).toBe(true);
  });

  it("stays bounded when many distinct keys arrive", () => {
    const rl = createRateLimiter(1, 1000, 10);
    for (let i = 0; i < 100; i++) expect(rl.hit(`k${i}`, 0)).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req)).toBe("1.2.3.4");
  });
  it("falls back to a shared bucket", () => {
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});
