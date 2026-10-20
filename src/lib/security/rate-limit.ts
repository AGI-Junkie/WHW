/**
 * Fixed-window request counter per key (client IP). shortcut: in-memory, so each serverless instance
 * counts on its own and a restart resets it; move to a shared store (Upstash, Vercel KV) if the
 * proxy is ever abused at scale.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (!h && hits.size >= maxKeys) {
        // Bound memory without punishing counted clients: drop expired buckets first, and if every
        // bucket is still active, refuse new keys until one expires instead of resetting all limits.
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
        if (hits.size >= maxKeys) return false;
      }
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}

/**
 * The rate-limit key. The first x-forwarded-for entry is whatever the caller sent, so it is never
 * used: x-real-ip is set by the platform or reverse proxy (Vercel, or Nginx/Caddy configured to set
 * it), and otherwise the last x-forwarded-for entry is the one the nearest proxy appended. With no
 * proxy at all it returns "direct" (the caller is then not rate-limited). shortcut: assumes at most one proxy hop; behind a
 * chain of proxies, set x-real-ip at the edge.
 */
export function clientKey(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? [];
  return hops.at(-1) ?? "direct";
}
