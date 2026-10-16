/**
 * Fixed-window, in-memory rate limiter for the Wikipedia proxy. Per-instance only (serverless
 * instances don't share memory), so it bounds abuse from one client against one instance rather
 * than guaranteeing a global limit. Upstream responses are cached, so legitimate use stays far below it.
 */
export interface RateLimiter {
  /** True if the request is allowed; false once `limit` hits were seen for `key` in the window. */
  hit(key: string, now?: number): boolean;
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    hit(key, now = Date.now()) {
      const w = windows.get(key);
      if (!w || now - w.start >= windowMs) {
        if (windows.size >= maxKeys) {
          for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
          if (windows.size >= maxKeys) windows.clear();
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= limit;
    },
  };
}

/** Best-effort client id from proxy headers; unknown clients share one bucket. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}
