"use client";

const KEYS: [string, string][] = [
  ["Space", "Play / pause history (in a story: autoplay)"],
  ["← →", "Previous / next event in time (in a story or tour: chapters, stops)"],
  ["S or Enter", "Open the selected event as an immersive story"],
  ["R", "Surprise me: a random event"],
  ["⌘K, Ctrl+K or /", "Search events, countries and years"],
  ["Esc", "Close the story, tour or panel"],
  ["?", "This help"],
];

export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="help" role="dialog" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Keyboard shortcuts</h2>
        <dl>
          {KEYS.map(([k, v]) => (
            <div key={k}>
              <dt><kbd>{k}</kbd></dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="credit">The address bar always holds a link to what you are looking at: copy it to share a year, an event or a story.</p>
      </div>
    </div>
  );
}
