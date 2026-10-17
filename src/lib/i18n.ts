"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ZH } from "./i18n-zh";

/**
 * UI language. Keys are the English strings themselves, so a missing translation falls back to
 * readable English and call sites stay greppable. Curated data (event titles, summaries, tour
 * narration) stays English; in Chinese the live Wikipedia block switches to zh.wikipedia.
 */
export type Locale = "en" | "zh";
const KEY = "whw-locale";

export function translate(locale: Locale, text: string, vars?: Record<string, string | number>): string {
  let out = locale === "zh" ? (ZH[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** Years in the UI language: "500 BC" / "公元前500年", "AD 79" / "79年", "1453" / "1453年". */
export function formatYearIn(locale: Locale, year: number): string {
  if (locale === "zh") return year < 0 ? `公元前${-year}年` : `${year}年`;
  if (year < 0) return `${-year} BC`;
  return year < 1000 ? `AD ${year}` : String(year);
}

// A tiny external store: the saved choice, else the browser language. The server renders English
// (getServerSnapshot), and React switches after hydration without a mismatch.
let current: Locale | null = null;
const listeners = new Set<() => void>();

function readLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* storage may be unavailable */
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getSnapshot(): Locale {
  return (current ??= readLocale());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setLocale(l: Locale): void {
  current = l;
  try {
    window.localStorage.setItem(KEY, l);
  } catch {
    /* storage may be unavailable */
  }
  listeners.forEach((f) => f());
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => "en" as const);
  const t = useCallback((text: string, vars?: Record<string, string | number>) => translate(locale, text, vars), [locale]);
  const fy = useCallback((year: number) => formatYearIn(locale, year), [locale]);
  return { locale, setLocale, t, fy };
}
