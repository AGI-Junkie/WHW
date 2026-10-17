"use client";

import { useEffect } from "react";

/**
 * While a dialog is open, Esc closes it and no other shortcut reaches the app underneath (the
 * store's ← → / Esc / Space handler would otherwise move the hidden story, tour or quiz). Runs in
 * the capture phase on window, before those bubble-phase listeners; Tab and native button
 * activation still work because nothing calls preventDefault.
 */
export function useOverlayKeys(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
}
