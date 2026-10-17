/**
 * Fixed-window request counter per key (client IP). shortcut: in-memory, so each serverless instance
 * counts on its own and a restart resets it; move to a shared store (Upstash, Vercel KV) if the
 * proxy is ever abused at scale.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (hits.size > 10_000) hits.clear(); // bound memory under a flood of distinct keys
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}
