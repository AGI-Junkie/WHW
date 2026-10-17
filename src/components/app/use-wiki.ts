"use client";

import { useEffect, useState } from "react";
import type { WikiSummaryResponse } from "@/lib/data/schemas";
import type { Locale } from "@/lib/i18n";

/** Live Wikipedia summary through the same-origin proxy, in the UI language; null while loading. */
export function useWiki(title: string | null, lang: Locale = "en"): WikiSummaryResponse | null {
  const [result, setResult] = useState<{ key: string; data: WikiSummaryResponse } | null>(null);
  const key = `${lang}:${title}`;
  useEffect(() => {
    if (!title) return;
    let alive = true;
    fetch(`/api/wiki/summary?title=${encodeURIComponent(title)}&lang=${lang}`)
      .then((r) => r.json() as Promise<WikiSummaryResponse>)
      .then((data) => {
        if (alive) setResult({ key, data });
      })
      .catch(() => {
        if (alive) setResult({ key, data: { ok: false, reason: "network" } });
      });
    return () => {
      alive = false;
    };
  }, [title, lang, key]);
  return title && result && result.key === key ? result.data : null;
}
