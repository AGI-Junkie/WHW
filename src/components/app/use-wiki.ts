"use client";

import { useEffect, useState } from "react";
import type { WikiSummaryResponse } from "@/lib/data/schemas";

/** Live Wikipedia summary through the same-origin proxy; null while loading. */
export function useWiki(title: string | null): WikiSummaryResponse | null {
  const [result, setResult] = useState<{ title: string; data: WikiSummaryResponse } | null>(null);
  useEffect(() => {
    if (!title) return;
    let alive = true;
    fetch(`/api/wiki/summary?title=${encodeURIComponent(title)}`)
      .then((r) => r.json() as Promise<WikiSummaryResponse>)
      .then((data) => {
        if (alive) setResult({ title, data });
      })
      .catch(() => {
        if (alive) setResult({ title, data: { ok: false, reason: "network" } });
      });
    return () => {
      alive = false;
    };
  }, [title]);
  return result && result.title === title ? result.data : null;
}
