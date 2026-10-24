import { act, StrictMode, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HistoryProvider, useHistory } from "@/lib/store/history-store";
import { fetchCountries, fetchSnapshot, fetchSnapshotIndex } from "@/lib/data/loaders";
import type { BorderFeature } from "@/lib/data/schemas";

vi.mock("@/lib/data/loaders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/loaders")>()),
  fetchCountries: vi.fn(),
  fetchSnapshot: vi.fn(),
  fetchSnapshotIndex: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
let history: ReturnType<typeof useHistory>;
let snapshots: (number | null)[];

function Probe() {
  const value = useHistory();
  useLayoutEffect(() => {
    history = value;
    snapshots.push(value.state.snapshotYear);
  }, [value]);
  return null;
}

async function mount() {
  await act(async () =>
    root.render(
      <StrictMode>
        <HistoryProvider>
          <Probe />
        </HistoryProvider>
      </StrictMode>,
    ),
  );
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  snapshots = [];
  vi.stubGlobal("requestIdleCallback", vi.fn());
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.mocked(fetchCountries).mockResolvedValue([]);
  vi.mocked(fetchSnapshotIndex).mockResolvedValue([1914, 1945]);
  vi.mocked(fetchSnapshot).mockResolvedValue([]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("restores discovery and My tour before saving, including StrictMode remounts", async () => {
  const saved = { events: ["apollo-11"], countries: ["France"], toursCompleted: ["ww2"] };
  window.localStorage.setItem("whw-discovery-v1", JSON.stringify(saved));
  window.localStorage.setItem("whw-my-tour-v1", JSON.stringify(["apollo-11"]));
  await mount();
  expect(history.state.discovery).toEqual(saved);
  expect(JSON.parse(window.localStorage.getItem("whw-discovery-v1")!)).toEqual(saved);
  expect(history.state.myTour).toEqual(["apollo-11"]);
  expect(JSON.parse(window.localStorage.getItem("whw-my-tour-v1")!)).toEqual(["apollo-11"]);
  await act(async () =>
    history.dispatch({ type: "select", selection: { kind: "event", id: "battle-of-hastings" } }),
  );
  expect(JSON.parse(window.localStorage.getItem("whw-discovery-v1")!).events).toContain(
    "battle-of-hastings",
  );
});

it.each(["resolve", "reject"])(
  "ignores a stale snapshot %s after returning to the loaded year",
  async (outcome) => {
    let resolve!: (features: BorderFeature[]) => void;
    let reject!: (reason: Error) => void;
    const pending = new Promise<BorderFeature[]>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    vi.mocked(fetchSnapshot).mockImplementation((year) =>
      year === 1914 ? pending : Promise.resolve([]),
    );
    await mount();
    expect(history.state.snapshotYear).toBe(1945);
    await act(async () => history.dispatch({ type: "setYear", year: 1914 }));
    await act(async () => history.dispatch({ type: "setYear", year: 1950 }));
    snapshots = [];
    await act(async () => {
      if (outcome === "resolve") resolve([]);
      else reject(new Error("1914 snapshot failed"));
      await pending.catch(() => {});
    });
    expect(history.state.year).toBe(1950);
    expect(history.state.snapshotYear).toBe(1945);
    expect(snapshots).not.toContain(1914);
    expect(history.state.error).toBeNull();
  },
);

it("reads successive shared links and removes the previous mode, selection and filters", async () => {
  await mount();
  const navigate = async (hash: string) => {
    await act(async () => {
      window.history.pushState(null, "", hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  };
  await navigate("#e=apollo-11&s=1&hide=war");
  expect(history.state.story?.id).toBe("apollo-11");
  expect(history.state.hiddenCategories).toEqual(["war"]);
  await navigate("#y=1066&e=battle-of-hastings");
  expect(history.state.story).toBeNull();
  expect(history.state.year).toBe(1066);
  expect(history.state.selection).toEqual({ kind: "event", id: "battle-of-hastings" });
  expect(history.state.hiddenCategories).toEqual([]);
  await navigate("#t=fall-of-constantinople,apollo-11");
  expect(history.state.tour?.id).toBe("mine");
  await navigate("#y=1453");
  expect(history.state.tour).toBeNull();
  expect(history.state.selection).toBeNull();
  expect(history.state.year).toBe(1453);
  await act(async () => vi.advanceTimersByTime(500));
  expect(window.location.hash).toBe("#y=1453");
});
