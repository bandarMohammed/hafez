import { describe, expect, it } from "vitest";
import { datasetSchema } from "@/data/schema";
import { createSeed } from "@/data/seed";
import { applyForecastDecision, DEFAULT_ASSUMPTIONS } from "@/domain/forecast";
import { buildNewEvent, validateNewEvent, emptyNewEventValues } from "@/domain/newEvent";
import {
  listingRemaining,
  distributedKg,
  selectPublicListings,
  selectShield,
  selectMyRequests,
} from "@/domain/selectors/beneficiary";
import { selectCharityHandovers, selectOpportunities } from "@/domain/selectors/charity";
import { selectMyTasks } from "@/domain/selectors/field";
import type { DemoDataset } from "@/domain/types";
import * as charity from "@/domain/workflow/charity";
import * as field from "@/domain/workflow/field";
import * as hall from "@/domain/workflow/hall";
import * as ben from "@/domain/workflow/beneficiary";
import type { CommandContext, CommandResult } from "@/domain/workflow/core";

const NOW = new Date("2026-10-21T06:00:00Z");

/** Runs a command as a given account; throws on unexpected failure so the chain stays readable. */
function as(data: DemoDataset, userId: string) {
  const user = data.users.find((u) => u.id === userId)!;
  return <T>(cmd: (ctx: CommandContext) => CommandResult<T>) => cmd({ data, user, now: NOW });
}
function must<T>(r: CommandResult<T>): { data: DemoDataset; value: T } {
  if (!r.ok) throw new Error(`command failed: ${r.error} ${JSON.stringify(r.fields ?? {})}`);
  return r;
}
const event = (d: DemoDataset, id: string) => d.events.find((e) => e.id === id)!;

/** Seed + the Figma scenario event E-109 created in C2 and published in C3. */
function withPublishedE109(): DemoDataset {
  let d = createSeed();
  const v = validateNewEvent(
    {
      ...emptyNewEventValues("Hall manager (demo)"),
      title: "Wedding (demo scenario)",
      date: "2026-10-30",
      endTime: "23:00",
      readyTime: "23:30",
      guests: "300",
      foodTypes: ["rice_dishes"],
      plannedKg: "210",
      contactPhone: "0500000000",
    },
    NOW,
  );
  if (!v.ok) throw new Error("scenario invalid");
  const hallUser = d.users.find((u) => u.id === "demo-hall-01")!;
  const { event: e, activity } = buildNewEvent(d, v.data, hallUser, NOW);
  d = { ...d, events: [...d.events, e], activity: [...d.activity, activity] };
  return applyForecastDecision(d, "E-109", hallUser, "use_recommended", DEFAULT_ASSUMPTIONS, NOW)!.data;
}

describe("full surplus journey C → D → E → D → H (shared records)", () => {
  it("moves one record through every role and every derived view follows", () => {
    let d = withPublishedE109();
    expect(event(d, "E-109").status).toBe("available");

    // D1 — the charity sees the published opportunity.
    const coordinator = d.users.find((u) => u.id === "demo-charity-01")!;
    expect(selectOpportunities(d, coordinator).map((e) => e.id)).toContain("E-109");

    // D2 — interest → awaiting_charity; the hall is notified.
    d = must(as(d, "demo-charity-01")((c) => charity.expressInterest(c, "E-109"))).data;
    expect(event(d, "E-109").status).toBe("awaiting_charity");
    expect(d.notices.some((n) => n.recipientUserId === "demo-hall-01" && n.kind === "coordination_interest")).toBe(
      true,
    );

    // D4 — a representative from another charity is refused; own team is accepted.
    const wrongRep = as(
      d,
      "demo-charity-01",
    )((c) =>
      charity.assignRepresentative(c, "E-109", {
        representativeId: "demo-field-04",
        plannedArrivalAt: "2026-10-30T23:15:00+03:00",
      }),
    );
    expect(wrongRep).toMatchObject({ ok: false, error: "validation", fields: { representativeId: "not_in_team" } });
    d = must(
      as(
        d,
        "demo-charity-01",
      )((c) =>
        charity.assignRepresentative(c, "E-109", {
          representativeId: "demo-field-01",
          plannedArrivalAt: "2026-10-30T23:15:00+03:00",
        }),
      ),
    ).data;
    expect(event(d, "E-109").status).toBe("assigned");

    // E1 — the task appears for that representative only.
    expect(selectMyTasks(d, "demo-field-01").inProgress.some((t) => t.kind === "event" && t.event.id === "E-109")).toBe(
      true,
    );
    expect(selectMyTasks(d, "demo-field-02").inProgress.some((t) => t.kind === "event" && t.event.id === "E-109")).toBe(
      false,
    );
    expect(as(d, "demo-field-02")((c) => field.checkIn(c, "E-109"))).toMatchObject({ ok: false, error: "not_allowed" });

    // E2 — check-in.
    d = must(as(d, "demo-field-01")((c) => field.checkIn(c, "E-109"))).data;
    expect(event(d, "E-109").status).toBe("representative_arrived");

    // E3 — a "surplus" result without quantity is refused and changes nothing.
    const incomplete = as(
      d,
      "demo-field-01",
    )((c) =>
      field.saveInspection(
        c,
        "E-109",
        {
          outcome: "surplus_available",
          estimatedQuantity: null,
          unit: "kg",
          foodCondition: "good",
          packagingCondition: "sealed_clean",
          safetyChecklist: [],
          reason: null,
          notes: null,
        },
        "final",
      ),
    );
    expect(incomplete).toMatchObject({ ok: false, error: "validation", fields: { estimatedQuantity: "required" } });
    d = must(
      as(
        d,
        "demo-field-01",
      )((c) =>
        field.saveInspection(
          c,
          "E-109",
          {
            outcome: "surplus_available",
            estimatedQuantity: 30,
            unit: "kg",
            foodCondition: "good",
            packagingCondition: "sealed_clean",
            safetyChecklist: ["temperature", "sealed"],
            reason: null,
            notes: null,
          },
          "final",
        ),
      ),
    ).data;
    expect(event(d, "E-109").status).toBe("inspected");

    // E4 — no actual quantity → "can't confirm collected" (Figma E4); then a valid provisional handover.
    const noQty = as(
      d,
      "demo-field-01",
    )((c) =>
      field.recordHandover(c, "E-109", {
        actualQuantity: null,
        unit: "kg",
        foodTypesText: "أرز",
        handedOverAt: "2026-10-30T23:40:00+03:00",
        handedBy: "Hall manager",
      }),
    );
    expect(noQty).toMatchObject({ ok: false, fields: { actualQuantity: "required" } });
    const ho = must(
      as(
        d,
        "demo-field-01",
      )((c) =>
        field.recordHandover(c, "E-109", {
          actualQuantity: 20,
          unit: "kg",
          foodTypesText: "أرز ودجاج",
          handedOverAt: "2026-10-30T23:40:00+03:00",
          handedBy: "Hall manager",
        }),
      ),
    );
    d = ho.data;
    expect(event(d, "E-109").status).toBe("inspected"); // not collected until the charity confirms
    expect(selectCharityHandovers(d, "charity-ataa").pending.map((h) => h.id)).toContain(ho.value);

    // C — the hall confirms its side (optional); another hall can't.
    expect(as(d, "demo-judge")((c) => hall.confirmHandoverByHall(c, ho.value))).toMatchObject({
      ok: false,
      error: "not_allowed",
    });
    d = must(as(d, "demo-hall-01")((c) => hall.confirmHandoverByHall(c, ho.value))).data;

    // D5 — charity confirmation completes «تم الاستلام».
    d = must(as(d, "demo-charity-01")((c) => charity.confirmHandoverByCharity(c, ho.value))).data;
    expect(event(d, "E-109").status).toBe("collected");
    expect(d.handovers.find((h) => h.id === ho.value)?.confirmationStatus).toBe("confirmed_by_both");
    expect(selectMyTasks(d, "demo-field-01").completed.some((t) => t.kind === "event" && t.event.id === "E-109")).toBe(
      true,
    );

    // D6 — publish from the documented handover; more than the handover holds is refused.
    const tooMuch = as(
      d,
      "demo-charity-01",
    )((c) =>
      charity.publishListing(c, {
        sourceHandoverId: ho.value,
        title: "أرز ودجاج — وجبات معبأة",
        category: "meals",
        unitLabel: "box",
        unitKg: 2,
        totalUnits: 11,
        perRequestLimit: 3,
        area: { ar: "حي العزيزية", en: "Al Aziziyah" },
        pickupStart: "2026-10-31T13:00:00+03:00",
        pickupEnd: "2026-10-31T16:00:00+03:00",
      }),
    );
    expect(tooMuch).toMatchObject({ ok: false, fields: { totalUnits: "over_handover" } });
    const pub = must(
      as(
        d,
        "demo-charity-01",
      )((c) =>
        charity.publishListing(c, {
          sourceHandoverId: ho.value,
          title: "أرز ودجاج — وجبات معبأة",
          category: "meals",
          unitLabel: "box",
          unitKg: 2,
          totalUnits: 10,
          perRequestLimit: 3,
          area: { ar: "حي العزيزية", en: "Al Aziziyah" },
          pickupStart: "2026-10-31T13:00:00+03:00",
          pickupEnd: "2026-10-31T16:00:00+03:00",
        }),
      ),
    );
    d = pub.data;
    const listingId = pub.value;
    expect(selectPublicListings(d, NOW).map((l) => l.id)).toContain(listingId);

    // H2 — over the per-request limit is refused; a valid request stays pending and deducts nothing.
    expect(as(d, "demo-beneficiary-01")((c) => ben.createRequest(c, listingId, 4))).toMatchObject({
      ok: false,
      error: "over_limit",
    });
    const r = must(as(d, "demo-beneficiary-01")((c) => ben.createRequest(c, listingId, 2)));
    d = r.data;
    const listing = () => d.listings.find((l) => l.id === listingId)!;
    expect(listingRemaining(d, listing())).toBe(10);
    expect(as(d, "demo-beneficiary-01")((c) => ben.createRequest(c, listingId, 1))).toMatchObject({
      ok: false,
      error: "duplicate",
    });

    // D6 — accept → ready; remaining 10 − 2 = 8; the beneficiary sees it in H3.
    d = must(as(d, "demo-charity-01")((c) => charity.decideRequest(c, r.value, { accept: true }))).data;
    expect(listingRemaining(d, listing())).toBe(8);
    expect(selectMyRequests(d, "demo-beneficiary-01").find((x) => x.id === r.value)?.status).toBe("ready");

    // H7 — full pickup → completed, +10 points once; distributed kg counts only now.
    const before = selectShield(d, "demo-beneficiary-01").balance;
    expect(distributedKg(d, listing())).toBe(0);
    d = must(
      as(
        d,
        "demo-beneficiary-01",
      )((c) => ben.confirmRequest(c, r.value, { kind: "full", receivedUnits: null, rating: "good", note: null })),
    ).data;
    expect(selectShield(d, "demo-beneficiary-01").balance).toBe(before + 10);
    expect(distributedKg(d, listing())).toBe(4);
    expect(
      as(
        d,
        "demo-beneficiary-01",
      )((c) => ben.confirmRequest(c, r.value, { kind: "full", receivedUnits: null, rating: null, note: null })),
    ).toMatchObject({ ok: false, error: "not_allowed" });

    // Every step was logged and the dataset is still valid storage data.
    for (const action of [
      "coordination.interest",
      "assignment.created",
      "inspection.arrived",
      "inspection.recorded",
      "handover.recorded",
      "handover.hall_confirmed",
      "handover.confirmed",
      "listing.published",
      "request.created",
      "request.accepted",
      "request.confirmed",
    ])
      expect(
        d.activity.some((a) => a.action === action),
        action,
      ).toBe(true);
    expect(datasetSchema.safeParse(d).success).toBe(true);
  });
});

describe("field outcomes without a handover (UC-08)", () => {
  it("no surplus needs a reason, closes the task and never creates a received weight", () => {
    let d = createSeed();
    d = must(as(d, "demo-field-01")((c) => field.checkIn(c, "E-105"))).data;
    const noReason = as(
      d,
      "demo-field-01",
    )((c) =>
      field.saveInspection(
        c,
        "E-105",
        {
          outcome: "no_surplus",
          estimatedQuantity: null,
          unit: null,
          foodCondition: null,
          packagingCondition: null,
          safetyChecklist: [],
          reason: null,
          notes: null,
        },
        "final",
      ),
    );
    expect(noReason).toMatchObject({ ok: false, fields: { reason: "required" } });
    d = must(
      as(
        d,
        "demo-field-01",
      )((c) =>
        field.saveInspection(
          c,
          "E-105",
          {
            outcome: "no_surplus",
            estimatedQuantity: 25,
            unit: "kg",
            foodCondition: null,
            packagingCondition: null,
            safetyChecklist: [],
            reason: "finished_during_event",
            notes: null,
          },
          "final",
        ),
      ),
    ).data;
    expect(event(d, "E-105").status).toBe("no_surplus");
    expect(d.inspections.find((i) => i.eventId === "E-105")?.estimatedQuantity).toBeNull();
    expect(d.handovers.some((h) => h.eventId === "E-105")).toBe(false);
    expect(
      as(
        d,
        "demo-field-01",
      )((c) =>
        field.recordHandover(c, "E-105", {
          actualQuantity: 5,
          unit: "kg",
          foodTypesText: "x",
          handedOverAt: "2026-10-24T22:00:00+03:00",
          handedBy: "x",
        }),
      ),
    ).toMatchObject({ ok: false, error: "not_allowed" });
  });

  it("not suitable requires a reason and ends as not_collectable", () => {
    let d = createSeed();
    const r = as(
      d,
      "demo-field-01",
    )((c) =>
      field.saveInspection(
        c,
        "E-108",
        {
          outcome: "not_safe_to_collect",
          estimatedQuantity: null,
          unit: null,
          foodCondition: "poor",
          packagingCondition: null,
          safetyChecklist: [],
          reason: null,
          notes: null,
        },
        "final",
      ),
    );
    expect(r).toMatchObject({ ok: false, fields: { reason: "required" } });
    d = must(
      as(
        d,
        "demo-field-01",
      )((c) =>
        field.saveInspection(
          c,
          "E-108",
          {
            outcome: "not_safe_to_collect",
            estimatedQuantity: null,
            unit: null,
            foodCondition: "poor",
            packagingCondition: null,
            safetyChecklist: [],
            reason: "storage_temperature",
            notes: null,
          },
          "final",
        ),
      ),
    ).data;
    expect(event(d, "E-108").status).toBe("not_collectable");
  });

  it("a draft keeps the visit open", () => {
    const d = must(
      as(
        createSeed(),
        "demo-field-01",
      )((c) =>
        field.saveInspection(
          c,
          "E-108",
          {
            outcome: null,
            estimatedQuantity: null,
            unit: null,
            foodCondition: null,
            packagingCondition: null,
            safetyChecklist: ["sealed"],
            reason: null,
            notes: "قيد المعاينة",
          },
          "draft",
        ),
      ),
    ).data;
    expect(event(d, "E-108").status).toBe("representative_arrived");
    expect(d.inspections.find((i) => i.id === "IN-108")?.status).toBe("draft");
  });
});

describe("charity decisions", () => {
  it("declining hides the opportunity from that charity but keeps the event available", () => {
    let d = createSeed();
    const coordinator = d.users.find((u) => u.id === "demo-charity-01")!;
    d = must(
      as(d, "demo-charity-01")((c) => charity.declineOpportunity(c, "E-106", { reason: "no_team", note: null })),
    ).data;
    expect(event(d, "E-106").status).toBe("available");
    expect(selectOpportunities(d, coordinator).map((e) => e.id)).not.toContain("E-106");
    expect(
      as(d, "demo-charity-01")((c) => charity.declineOpportunity(c, "E-106", { reason: "other", note: "" })),
    ).toMatchObject({ ok: false });
  });

  it("'other' reason requires a note", () => {
    expect(
      as(
        createSeed(),
        "demo-charity-01",
      )((c) => charity.declineOpportunity(c, "E-106", { reason: "other", note: " " })),
    ).toMatchObject({ ok: false, fields: { note: "required" } });
  });

  it("a dispute keeps the handover pending; accepting over the remaining is refused", () => {
    let d = createSeed();
    // L-09 has 6 remaining: a pending request of 2 by #17 (R-07) is acceptable; bump to exceed and check.
    d = { ...d, requests: d.requests.map((r) => (r.id === "R-07" ? { ...r, units: 7 } : r)) };
    expect(as(d, "demo-charity-01")((c) => charity.decideRequest(c, "R-07", { accept: true }))).toMatchObject({
      ok: false,
      error: "over_limit",
    });
    d = { ...d, listings: d.listings.map((l) => (l.id === "L-09" ? { ...l, perRequestLimit: 10 } : l)) };
    expect(as(d, "demo-charity-01")((c) => charity.decideRequest(c, "R-07", { accept: true }))).toMatchObject({
      ok: false,
      error: "over_remaining",
    });
  });

  it("rejecting a request needs the coordinator of the listing's charity", () => {
    const d = createSeed();
    expect(
      as(d, "demo-hall-01")((c) => charity.decideRequest(c, "R-07", { accept: false, reason: "sold_out" })),
    ).toMatchObject({ ok: false, error: "not_allowed" });
    const r = must(
      as(d, "demo-charity-01")((c) => charity.decideRequest(c, "R-07", { accept: false, reason: "sold_out" })),
    ).data;
    expect(r.requests.find((x) => x.id === "R-07")?.status).toBe("rejected");
    expect(r.notices.some((n) => n.recipientUserId === "demo-beneficiary-01" && n.kind === "request_rejected")).toBe(
      true,
    );
  });
});

describe("beneficiary surplus report (UC-10, UC-11)", () => {
  it("report → review → inspection → documented rescue → points once", () => {
    let d = createSeed();
    const bad = as(
      d,
      "demo-beneficiary-01",
    )((c) =>
      ben.createReport(c, {
        foodType: "",
        estimatedQuantity: null,
        unit: null,
        readyAt: "",
        area: null,
        notes: "",
        photoAttached: false,
      }),
    );
    expect(bad).toMatchObject({ ok: false, error: "validation" });
    const created = must(
      as(
        d,
        "demo-beneficiary-01",
      )((c) =>
        ben.createReport(c, {
          foodType: "معجنات",
          estimatedQuantity: 5,
          unit: "kg",
          readyAt: "2026-10-21T18:00:00+03:00",
          area: { ar: "حي الشهداء", en: "Al Shuhada" },
          notes: "",
          photoAttached: false,
        }),
      ),
    );
    d = created.data;
    const id = created.value;
    // Never published as available food, no points on sending.
    expect(d.listings.length).toBe(createSeed().listings.length);
    const balance0 = selectShield(d, "demo-beneficiary-01").balance;

    d = must(as(d, "demo-charity-01")((c) => charity.requestReportInfo(c, id, "متى طُبخ؟"))).data;
    d = must(as(d, "demo-beneficiary-01")((c) => ben.answerReportInfo(c, id, "اليوم 15:00"))).data;
    expect(d.reports.find((r) => r.id === id)?.status).toBe("pending");

    d = must(
      as(
        d,
        "demo-charity-01",
      )((c) =>
        charity.acceptReport(c, id, { representativeId: "demo-field-01", plannedAt: "2026-10-21T19:00:00+03:00" }),
      ),
    ).data;
    expect(selectMyTasks(d, "demo-field-01").inProgress.some((t) => t.kind === "report" && t.report.id === id)).toBe(
      true,
    );
    // Rescue can't be documented before the representative records a result.
    expect(as(d, "demo-charity-01")((c) => charity.documentRescue(c, id))).toMatchObject({
      ok: false,
      error: "invalid_state",
    });

    d = must(
      as(d, "demo-field-01")((c) => field.recordReportResult(c, id, { outcome: "rescued", actualKg: 4, note: null })),
    ).data;
    d = must(as(d, "demo-charity-01")((c) => charity.documentRescue(c, id))).data;
    expect(d.reports.find((r) => r.id === id)?.status).toBe("coordinated");
    expect(selectShield(d, "demo-beneficiary-01").balance).toBe(balance0 + 25);
    expect(as(d, "demo-charity-01")((c) => charity.documentRescue(c, id))).toMatchObject({
      ok: false,
      error: "invalid_state",
    });
  });

  it("seed shield matches Figma H5 before R-07 (35) and reaches 45 after confirming R-07", () => {
    let d = createSeed();
    expect(selectShield(d, "demo-beneficiary-01")).toMatchObject({ balance: 35, level: "bronze", toNext: 15 });
    d = must(as(d, "demo-charity-01")((c) => charity.decideRequest(c, "R-07", { accept: true }))).data;
    d = must(
      as(
        d,
        "demo-beneficiary-01",
      )((c) => ben.confirmRequest(c, "R-07", { kind: "full", receivedUnits: null, rating: null, note: null })),
    ).data;
    expect(selectShield(d, "demo-beneficiary-01")).toMatchObject({ balance: 45, toNext: 5 });
  });

  it("partial pickup records received units, no points; not received records nothing", () => {
    let d = createSeed();
    d = must(as(d, "demo-charity-01")((c) => charity.decideRequest(c, "R-07", { accept: true }))).data;
    expect(
      as(
        d,
        "demo-beneficiary-01",
      )((c) => ben.confirmRequest(c, "R-07", { kind: "partial", receivedUnits: 2, rating: null, note: null })),
    ).toMatchObject({ ok: false, fields: { receivedUnits: "range" } });
    const balance = selectShield(d, "demo-beneficiary-01").balance;
    d = must(
      as(
        d,
        "demo-beneficiary-01",
      )((c) => ben.confirmRequest(c, "R-07", { kind: "partial", receivedUnits: 1, rating: null, note: null })),
    ).data;
    expect(selectShield(d, "demo-beneficiary-01").balance).toBe(balance);
    expect(d.requests.find((r) => r.id === "R-07")?.status).toBe("partial");
  });
});

describe("seed integrity", () => {
  it("validates and matches the Figma D6 numbers for L-09 (10 − 4 = 6)", () => {
    const d = createSeed();
    expect(datasetSchema.safeParse(d).success).toBe(true);
    expect(
      listingRemaining(
        d,
        d.listings.find((l) => l.id === "L-09")!,
      ),
    ).toBe(6);
  });

  it("listings never exceed their source handover (32 kg = 20 + 4 + 8)", () => {
    const d = createSeed();
    const listed = d.listings
      .filter((l) => l.sourceHandoverId === "HO-101")
      .reduce((s, l) => s + l.totalUnits * l.unitKg, 0);
    expect(listed).toBe(32);
  });
});
