import { act, useImperativeHandle, type Ref } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import GlobeCanvas from "@/components/globe/globe-canvas";

const globe = vi.hoisted(() => ({
  controls: { autoRotate: false },
  ready: undefined as (() => void) | undefined,
}));

vi.mock("@/components/globe/use-container-size", () => ({
  useContainerSize: () => ({ ref: { current: null }, width: 800, height: 600 }),
}));
vi.mock("react-globe.gl", () => ({
  default: function MockGlobe({
    ref,
    onGlobeReady,
  }: {
    ref: Ref<unknown>;
    onGlobeReady: () => void;
  }) {
    useImperativeHandle(ref, () => ({ controls: () => globe.controls, pointOfView: () => {} }));
    globe.ready = onGlobeReady;
    return null;
  },
}));

it("keeps rotation off when selection changes before textures finish loading", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = {
    polygons: [],
    polygonColor: () => "#000",
    pins: [],
    arcs: [],
    rings: [],
    cameraTarget: null,
  };
  try {
    await act(async () => root.render(<GlobeCanvas {...props} autoRotate />));
    await act(async () => root.render(<GlobeCanvas {...props} autoRotate={false} />));
    expect(globe.controls.autoRotate).toBe(false);
    await act(async () => globe.ready!());
    expect(globe.controls.autoRotate).toBe(false);
  } finally {
    await act(async () => root.unmount());
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
