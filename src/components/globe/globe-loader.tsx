"use client";

import dynamic from "next/dynamic";

/** WebGL only exists in the browser: the canvas is loaded client-side with a placeholder until then. */
const GlobeLoader = dynamic(() => import("./globe-canvas"), {
  ssr: false,
  loading: () => (
    <div className="globe-placeholder" role="status" aria-live="polite">
      <span>Preparing the globe… · 正在准备地球…</span>
    </div>
  ),
});

export default GlobeLoader;
