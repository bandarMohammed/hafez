import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { selectImpact } from "@/features/journey/impact";
import { JOURNEY_STEPS, playJourney } from "@/features/journey/scenario";

const NOW = new Date("2026-10-22T06:00:00Z");
const TIP = "tip-batch-serving";

describe("impact dashboard numbers", () => {
  it("seed: documented rescue keeps estimates apart and matches the role screens", () => {
    const s = selectImpact(createSeed(), NOW);
    expect(s.events).toBe(8);
    expect(s.hallsKg).toBe(32); // HO-101, confirmed by the charity
    expect(s.reportsKg).toBe(4); // B-01 documented rescue
    expect(s.rescuedKg).toBe(36);
    expect(s.listedKg).toBe(32); // L-07/L-08/L-09 packaged from HO-101
    expect(s.distributedKg).toBe(14);
    expect(s.avoidedKg).toBe(0);
    // Cumulative, never decreasing, ends today with the totals.
    const last = s.series[s.series.length - 1]!;
    expect(last).toMatchObject({ day: "2026-10-22", rescued: 36, distributed: 14 });
    for (let i = 1; i < s.series.length; i++) {
      expect(s.series[i]!.rescued).toBeGreaterThanOrEqual(s.series[i - 1]!.rescued);
      expect(s.series[i]!.distributed).toBeGreaterThanOrEqual(s.series[i - 1]!.distributed);
    }
  });

  it("after the whole journey: +30 kg avoided (estimate), +20 rescued, +4 distributed", () => {
    const seed = createSeed();
    const admin = seed.users.find((u) => u.id === "demo-admin")!;
    const r = playJourney([...JOURNEY_STEPS], TIP)({ data: seed, user: admin, now: NOW });
    if (!r.ok) throw new Error(r.error);
    const before = selectImpact(seed, NOW);
    const after = selectImpact(r.data, NOW);
    expect(after.avoidedKg - before.avoidedKg).toBe(30);
    expect(after.hallsKg - before.hallsKg).toBe(20);
    expect(after.distributedKg - before.distributedKg).toBe(4);
    expect(after.confirmedPickups - before.confirmedPickups).toBe(1);
    expect(after.pledges - before.pledges).toBe(1);
    expect(after.series[after.series.length - 1]).toMatchObject({ rescued: 56, distributed: 18 });
  });
});
