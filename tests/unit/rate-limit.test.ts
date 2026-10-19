import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/security/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const allow = createRateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => allow("ip", 0))).toEqual([true, true, true, false]);
  });

  it("tracks clients independently and resets after the window", () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 500)).toBe(false);
    expect(allow("b", 500)).toBe(true);
    expect(allow("a", 1000)).toBe(true);
  });

  it("bounds memory without resetting active limits", () => {
    const allow = createRateLimiter(1, 1000, 3);
    expect([1, 2, 3].map((i) => allow(`k${i}`, 0))).toEqual([true, true, true]);
    // At capacity with every bucket active: new keys are refused, existing limits survive.
    expect(allow("k4", 0)).toBe(false);
    expect(allow("k1", 0)).toBe(false); // k1 is at its limit of 1 and is still enforced
    // Once windows expire the space is reclaimed and new keys are accepted again.
    expect(allow("k4", 1000)).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefers x-real-ip, which the platform or edge proxy sets", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" });
    expect(clientKey(headers)).toBe("1.2.3.4");
  });

  it("otherwise trusts only the last forwarded hop, the one the nearest proxy appended", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientKey(headers)).toBe("5.6.7.8");
  });

  it("returns direct with no proxy headers, so one shared bucket cannot lock everyone out", () => {
    expect(clientKey(new Headers())).toBe("direct");
  });
});
