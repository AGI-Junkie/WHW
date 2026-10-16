import { describe, expect, it } from "vitest";
import { battleArcs } from "@/lib/domain/battles";
import type { HistoryEvent } from "@/lib/data/schemas";
import { getEventById } from "@/lib/data/loaders";

const war = getEventById("punic-wars-begin") as HistoryEvent; // -264 to -146, two sides

describe("battleArcs", () => {
  it("draws arcs only while the conflict is under way", () => {
    expect(battleArcs([war], -300)).toHaveLength(0);
    expect(battleArcs([war], -200).length).toBeGreaterThan(0);
    expect(battleArcs([war], -100)).toHaveLength(0);
  });

  it("includes both endpoints of side a against side b", () => {
    const a = war.belligerents!.find((b) => b.side === "a")!;
    const b = war.belligerents!.find((x) => x.side === "b")!;
    const arc = battleArcs([war], -200)[0]!;
    expect([arc.startLat, arc.startLng]).toEqual([a.lat, a.lng]);
    expect([arc.endLat, arc.endLng]).toEqual([b.lat, b.lng]);
  });

  it("ignores events without belligerents", () => {
    const peace: HistoryEvent = { ...war, belligerents: undefined };
    expect(battleArcs([peace], -200)).toHaveLength(0);
  });

  it("caps arcs per event", () => {
    const side = (s: "a" | "b", n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `${s}${i}`, side: s, lat: i, lng: i }));
    const big: HistoryEvent = { ...war, belligerents: [...side("a", 6), ...side("b", 6)] };
    expect(battleArcs([big], -200)).toHaveLength(8);
  });
});
