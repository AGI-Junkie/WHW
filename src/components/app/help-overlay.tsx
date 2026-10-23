"use client";

import { useI18n } from "@/lib/i18n";
import { useOverlayKeys } from "./use-overlay-keys";

const KEYS: [string, string][] = [
  ["Space", "Play / pause history (in a story: autoplay)"],
  ["← →", "Previous / next event in time (in a story or tour: chapters, stops)"],
  ["S or Enter", "Open the selected event as an immersive story"],
  ["R", "Surprise me: a random event"],
  ["L", "Show the events in view as a list"],
  ["⌘K, Ctrl+K or /", "Search events, countries and years"],
  ["Esc", "Close the story, tour, quiz or panel"],
  ["?", "This help"],
];

export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const dialog = useOverlayKeys(onClose);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        {...dialog}
        className="help"
        role="dialog"
        aria-label={t("Keyboard shortcuts")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label={t("Close")}>
          ×
        </button>
        <h2>{t("Keyboard shortcuts")}</h2>
        <dl>
          {KEYS.map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{t(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="credit">
          {t(
            "The address bar always holds a link to what you are looking at: copy it to share a year, an event or a story.",
          )}
        </p>
      </div>
    </div>
  );
}
