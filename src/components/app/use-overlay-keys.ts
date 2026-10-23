"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keep focus and shortcuts inside the dialog, then hand focus back to its opener. */
export function useOverlayKeys(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog)?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      const dialog = ref.current;
      if (!dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) =>
          !el.hidden &&
          getComputedStyle(el).display !== "none" &&
          getComputedStyle(el).visibility !== "hidden",
      );
      const first = items[0] ?? dialog;
      const last = items.at(-1) ?? dialog;
      if (
        !items.length ||
        (e.shiftKey ? document.activeElement === first : document.activeElement === last)
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
  };

  return { ref, onKeyDown, tabIndex: -1, "aria-modal": true as const };
}
