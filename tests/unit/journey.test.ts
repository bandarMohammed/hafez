import { describe, expect, it } from "vitest";
import { datasetSchema } from "@/data/schema";
import { createSeed } from "@/data/seed";
import { distributedKg, selectShield } from "@/domain/selectors/beneficiary";
import type { DemoDataset } from "@/domain/types";
import type { CommandResult } from "@/domain/workflow/core";
import { checkIn } from "@/domain/workflow/field";
import {
  JOURNEY,
  JOURNEY_STEPS,
  canRunJourney,
  manualStepLink,
  playJourney,
  remainingSteps,
  selectJourney,
} from "@/features/journey/scenario";

const NOW = new Date("2026-10-21T06:00:00Z");
const TIP = "tip-batch-serving";

function play(data: DemoDataset, userId: string, steps = remainingSteps(selectJourney(data, TIP))): CommandResult {
  const user = data.users.find((u) => u.id === userId)!;
  return playJourney(steps, TIP)({ data, user, now: NOW });
}

describe("Hafez journey (pitch page scenario)", () => {
  it("starts at the hall step on the seed", () => {
    const s = selectJourney(createSeed(), TIP);
    expect(s.next).toBe("hall");
    expect(Object.values(s.done).every((d) => !d)).toBe(true);
  });

  it("only the platform manager can play it — judges stay read-only", () => {
    const seed = createSeed();
    const judge = seed.users.find((u) => u.role === "judge_viewer")!;
    const admin = seed.users.find((u) => u.role === "admin")!;
    expect(canRunJourney(admin)).toBe(true);
    expect(canRunJourney(judge)).toBe(false);
    const r = play(seed, judge.id);
    expect(r.ok).toBe(false);
  });

  it("steps must run in order", () => {
    const r = play(createSeed(), "demo-admin", ["charity"]);
    expect(r).toMatchObject({ ok: false, error: "invalid_state" });
  });

  it("walks one record through every role with the Figma B5 numbers", () => {
    let data = createSeed();
    const balanceBefore = selectShield(data, JOURNEY.beneficiary).balance;
    const distributedBefore = distributedKg(data);
    for (const step of JOURNEY_STEPS) {
      const r = play(data, "demo-admin", [step]);
      if (!r.ok) throw new Error(`${step}: ${r.error} ${JSON.stringify(r.fields ?? {})}`);
      data = r.data;
      expect(selectJourney(data, TIP).done[step]).toBe(true);
    }
    const s = selectJourney(data, TIP);
    expect(s.next).toBeNull();
    expect(s.event).toMatchObject({ id: "E-109", status: "collected", plannedQuantityKg: 180, expectedSurplusKg: 30 });
    expect(s.assignment?.representativeId).toBe(JOURNEY.rep);
    expect(s.handover).toMatchObject({ actualQuantity: 20, confirmationStatus: "confirmed_by_charity" });
    expect(s.listing).toMatchObject({ totalUnits: 10, unitKg: 2 });
    expect(s.request).toMatchObject({ units: 2, status: "completed" });
    expect(distributedKg(data) - distributedBefore).toBe(4);
    expect(selectShield(data, JOURNEY.beneficiary).balance - balanceBefore).toBe(10);
    // Every role left a trace in the same activity log, and the result is still a valid dataset.
    const actions = data.activity.filter((a) => a.timestamp === NOW.toISOString()).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "event.created",
        "coordination.interest",
        "assignment.created",
        "handover.recorded",
        "handover.confirmed",
        "listing.published",
        "request.created",
        "request.accepted",
        "request.confirmed",
      ]),
    );
    expect(datasetSchema.safeParse(data).success).toBe(true);
  });

  it("'play all' is one change: it succeeds fully, and a finished journey can't run again", () => {
    const r = play(createSeed(), "demo-admin");
    if (!r.ok) throw new Error(r.error);
    expect(selectJourney(r.data, TIP).next).toBeNull();
    expect(play(r.data, "demo-admin", ["hall"]).ok).toBe(false);
  });

  it("a step started by hand in the role screen is resumed, not repeated", () => {
    let data = createSeed();
    for (const step of ["hall", "charity"] as const) {
      const r = play(data, "demo-admin", [step]);
      if (!r.ok) throw new Error(r.error);
      data = r.data;
    }
    const s = selectJourney(data, TIP);
    expect(manualStepLink(s)).toEqual({ account: JOURNEY.rep, path: `/field/tasks/${s.event!.id}` });
    // The rep checks in from the field screen…
    const rep = data.users.find((u) => u.id === JOURNEY.rep)!;
    const arrived = checkIn({ data, user: rep, now: NOW }, s.event!.id);
    if (!arrived.ok) throw new Error(arrived.error);
    // …then "play" finishes the inspection and handover without a second check-in.
    const r = play(arrived.data, "demo-admin", ["field"]);
    if (!r.ok) throw new Error(r.error);
    expect(selectJourney(r.data, TIP).done.field).toBe(true);
    expect(r.data.inspections.filter((i) => i.eventId === s.event!.id)).toHaveLength(1);
  });

  it("the hall step has no manual link (a C2 event wouldn't carry the journey title)", () => {
    expect(manualStepLink(selectJourney(createSeed(), TIP))).toBeNull();
  });
});
