import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { selectHallActivity, selectHallEvents, selectHallMetrics, selectLatestActivityByEvent } from "@/domain/hall";
import { activityMessageKey, quantityMessage } from "@/features/hall/presenters";

const HALL = "hall-nakheel";

describe("hall selectors (C1)", () => {
  it("lists only this hall's events: active by date first, then finished", () => {
    const ids = selectHallEvents(createSeed(), HALL).map((e) => e.id);
    expect(ids).toEqual(["E-104", "E-107", "E-103"]); // same order as Figma C1
  });

  it("derives metrics from records (Figma C1: 3 / 1 / 0)", () => {
    expect(selectHallMetrics(createSeed(), HALL)).toEqual({
      totalEvents: 3,
      awaitingCharity: 1,
      completedHandovers: 0,
    });
  });

  it("counts a confirmed handover for the hall that owns the event", () => {
    expect(selectHallMetrics(createSeed(), "hall-waha").completedHandovers).toBe(1);
  });

  it("metrics react to data changes (not hard-coded)", () => {
    const data = createSeed();
    data.events = data.events.filter((e) => e.id !== "E-104");
    expect(selectHallMetrics(data, HALL)).toEqual({ totalEvents: 2, awaitingCharity: 0, completedHandovers: 0 });
  });

  it("returns an empty list for a hall with no events", () => {
    const data = createSeed();
    data.events = data.events.filter((e) => e.hallId !== HALL);
    expect(selectHallEvents(data, HALL)).toEqual([]);
    expect(selectHallActivity(data, HALL)).toEqual([]);
  });

  it("activity is newest first, scoped to the hall, and limited", () => {
    const entries = selectHallActivity(createSeed(), HALL, 2);
    expect(entries.map((a) => a.id)).toEqual(["A-07", "A-06"]); // Figma C1 timeline: E-104 interest, E-107 created
    const all = selectHallActivity(createSeed(), HALL, 50);
    const hallEventIds = new Set(["E-103", "E-104", "E-107"]);
    expect(all.every((a) => hallEventIds.has(a.entityId))).toBe(true);
  });

  it("latest activity per event picks the newest entry", () => {
    expect(selectLatestActivityByEvent(createSeed()).get("E-104")?.id).toBe("A-07");
  });
});

describe("presenters", () => {
  const data = createSeed();
  const ev = (id: string) => data.events.find((e) => e.id === id)!;

  it("never mixes expected and actual quantities", () => {
    expect(quantityMessage(ev("E-104"), undefined)).toEqual({ key: "estimate", value: 40 });
    expect(quantityMessage(ev("E-107"), undefined)).toEqual({ key: "notEstimated" });
    expect(quantityMessage(ev("E-103"), undefined)).toEqual({ key: "notRecorded" });
    expect(quantityMessage(ev("E-102"), undefined)).toEqual({ key: "noSurplus" });
    const ho = data.handovers.find((h) => h.eventId === "E-101");
    expect(quantityMessage(ev("E-101"), ho)).toEqual({ key: "actual", value: 32 });
  });

  it("maps dotted activity actions to dot-free message keys", () => {
    expect(activityMessageKey("event.created")).toBe("event_created");
    expect(activityMessageKey("coordination.interest")).toBe("coordination_interest");
  });
});
