import { afterEach, describe, expect, it } from "vitest";
import { createLocalRepository, createMemoryStorage } from "@/data/repository";
import { datasetSchema } from "@/data/schema";
import { createSeed } from "@/data/seed";
import { __setRepositoryForTests, useDemoStore } from "@/data/store";
import { DEFAULT_ASSUMPTIONS, applyForecastDecision, computeForecast, forecastAvailability } from "@/domain/forecast";
import { buildNewEvent, validateNewEvent, emptyNewEventValues } from "@/domain/newEvent";
import type { DemoDataset } from "@/domain/types";

const NOW = new Date("2026-10-21T06:00:00Z");

/** Seed + the Figma C2 scenario event E-109 (300 guests, 210 kg planned, registered). */
function withScenarioEvent(): DemoDataset {
  const data = createSeed();
  const user = data.users.find((u) => u.id === "demo-hall-01")!;
  const v = validateNewEvent(
    {
      ...emptyNewEventValues("Hall manager (demo)"),
      title: "Wedding (demo scenario)",
      date: "2026-10-30",
      endTime: "23:00",
      readyTime: "23:30",
      guests: "300",
      foodTypes: ["hot_meals"],
      plannedKg: "210",
      contactPhone: "0500000000",
    },
    NOW,
  );
  if (!v.ok) throw new Error("scenario invalid");
  const { event, activity } = buildNewEvent(data, v.data, user, NOW);
  return { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
}

describe("computeForecast (C3 rule)", () => {
  it("reproduces the Figma scenario: 150 → 180 → reduce 30 → surplus 30 kg = 15 boxes; baseline 60", () => {
    expect(computeForecast({ guests: 300, plannedKg: 210 })).toEqual({
      guests: 300,
      plannedKg: 210,
      consumptionKg: 150,
      recommendedKg: 180, // not 181: 150 × 1.2 floating-point noise is removed before rounding up
      reductionKg: 30,
      surplusAfterKg: 30,
      fullBoxes: 15,
      baselineSurplusKg: 60,
    });
  });

  it("rounds the recommendation up to a whole kg", () => {
    const r = computeForecast({ guests: 301, plannedKg: 250 });
    expect(r.consumptionKg).toBe(150.5);
    expect(r.recommendedKg).toBe(181); // 180.6 → 181
    expect(r.surplusAfterKg).toBe(30.5);
    expect(r.fullBoxes).toBe(15);
  });

  it("never recommends more than planned (no reduction when planned is already low)", () => {
    const r = computeForecast({ guests: 300, plannedKg: 170 });
    expect(r.recommendedKg).toBe(170);
    expect(r.reductionKg).toBe(0);
    expect(r.surplusAfterKg).toBe(20);
    const tight = computeForecast({ guests: 300, plannedKg: 120 });
    expect(tight.surplusAfterKg).toBe(0);
    expect(tight.baselineSurplusKg).toBe(0);
  });

  it("follows adjusted assumptions", () => {
    const r = computeForecast({ guests: 300, plannedKg: 210 }, { kgPerGuest: 0.6, safetyMargin: 0.1 });
    expect(r).toMatchObject({
      consumptionKg: 180,
      recommendedKg: 198,
      reductionKg: 12,
      surplusAfterKg: 18,
      fullBoxes: 9,
    });
  });

  it("defaults come from the central config", () => {
    expect(DEFAULT_ASSUMPTIONS).toEqual({ kgPerGuest: 0.5, safetyMargin: 0.2 });
  });
});

describe("forecastAvailability", () => {
  const data = withScenarioEvent();
  const user = (id: string) => data.users.find((u) => u.id === id)!;
  const event = (id: string) => data.events.find((e) => e.id === id);

  it("is available for the hall's own new registered event", () => {
    expect(forecastAvailability(user("demo-hall-01"), event("E-109"))).toBe("ok");
  });

  it("explains why it is not available", () => {
    expect(forecastAvailability(user("demo-hall-01"), event("E-107"))).toBe("noPlannedQuantity"); // seed, no C2 data
    expect(forecastAvailability(user("demo-hall-01"), event("E-104"))).toBe("alreadyDecided"); // already published
    expect(forecastAvailability(user("demo-hall-01"), event("E-106"))).toBe("notFound"); // other hall
    expect(forecastAvailability(user("demo-hall-01"), undefined)).toBe("notFound");
    expect(forecastAvailability(user("demo-judge"), event("E-109"))).toBe("notAllowed"); // read-only
    expect(forecastAvailability(null, event("E-109"))).toBe("notFound");
  });
});

describe("applyForecastDecision", () => {
  const hall = (d: DemoDataset) => d.users.find((u) => u.id === "demo-hall-01")!;

  it("Use recommended → available, 180 kg planned, 30 kg expected surplus, decision recorded and logged", () => {
    const data = withScenarioEvent();
    const result = applyForecastDecision(data, "E-109", hall(data), "use_recommended", DEFAULT_ASSUMPTIONS, NOW)!;
    expect(result.event).toMatchObject({
      status: "available",
      plannedQuantityKg: 180,
      expectedSurplusKg: 30,
      forecast: { recommendedKg: 180, plannedKgBefore: 210, consumptionKg: 150, decision: "use_recommended" },
    });
    expect(result.data.activity.at(-1)).toMatchObject({
      action: "event.updated",
      entityId: "E-109",
      before: "registered",
      after: "available",
    });
    expect(datasetSchema.safeParse(result.data).success).toBe(true);
    // Deciding twice is refused.
    expect(
      applyForecastDecision(result.data, "E-109", hall(data), "keep_planned", DEFAULT_ASSUMPTIONS, NOW),
    ).toBeNull();
  });

  it("Keep planned → available, 210 kg planned, 60 kg expected surplus", () => {
    const data = withScenarioEvent();
    const result = applyForecastDecision(data, "E-109", hall(data), "keep_planned", DEFAULT_ASSUMPTIONS, NOW)!;
    expect(result.event).toMatchObject({ status: "available", plannedQuantityKg: 210, expectedSurplusKg: 60 });
  });

  it("stores the adjusted assumptions that were used", () => {
    const data = withScenarioEvent();
    const a = { kgPerGuest: 0.6, safetyMargin: 0.1 };
    const result = applyForecastDecision(data, "E-109", hall(data), "use_recommended", a, NOW)!;
    expect(result.event.forecast).toMatchObject({ kgPerGuest: 0.6, safetyMargin: 0.1, recommendedKg: 198 });
    expect(result.event.expectedSurplusKg).toBe(18);
  });
});

describe("store.decideForecast", () => {
  afterEach(() => {
    __setRepositoryForTests(null);
    useDemoStore.setState({ status: "idle", data: null, currentUserId: null, flash: null });
  });

  it("persists the decision and sets the published confirmation", () => {
    const storage = createMemoryStorage({ "hafez.demo.data.v1": JSON.stringify(withScenarioEvent()) });
    __setRepositoryForTests(createLocalRepository(storage));
    useDemoStore.setState({ status: "idle", data: null, currentUserId: null, flash: null });
    useDemoStore.getState().init();
    useDemoStore.getState().selectUser("demo-hall-01");

    expect(useDemoStore.getState().decideForecast("E-109", "use_recommended", DEFAULT_ASSUMPTIONS)).toBe(true);
    expect(useDemoStore.getState().flash).toEqual({
      kind: "eventPublished",
      eventId: "E-109",
      plannedKg: 180,
      expectedSurplusKg: 30,
    });
    const stored = JSON.parse(storage.getItem("hafez.demo.data.v1")!);
    expect(stored.events.find((e: { id: string }) => e.id === "E-109").status).toBe("available");
    expect(useDemoStore.getState().decideForecast("E-109", "keep_planned", DEFAULT_ASSUMPTIONS)).toBe(false);
  });
});
