import { can, eventRelations } from "../permissions";
import {
  FOOD_CONDITIONS,
  NOT_SUITABLE_REASONS,
  NO_SURPLUS_REASONS,
  PACKAGING_CONDITIONS,
  QUANTITY_UNITS,
} from "../types";
import type {
  FoodCondition,
  Inspection,
  InspectionOutcome,
  OutcomeReason,
  PackagingCondition,
  QuantityUnit,
  SafetyItem,
} from "../types";
import { fail, isIso, logActivity, nextId, notify, ok, replaceById, usersOf } from "./core";
import type { CommandContext, CommandResult } from "./core";

/* ================================================================ E2: check-in & "can't attend" */

/** E2 "Check in now" — assigned → representative_arrived; starts the inspection record. */
export function checkIn({ data, user, now }: CommandContext, eventId: string): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "task.checkin", { kind: "event", event, rel })) return fail("not_allowed");

  const inspection: Inspection = {
    id: nextId(
      "IN",
      data.inspections.map((i) => i.id),
    ),
    eventId,
    representativeId: user.id,
    arrivedAt: now.toISOString(),
    inspectedAt: null,
    status: "in_progress",
    outcome: null,
    estimatedQuantity: null,
    unit: null,
    foodCondition: null,
    packagingCondition: null,
    safetyChecklist: [],
    reason: null,
    notes: null,
  };
  let next = {
    ...data,
    inspections: [...data.inspections, inspection],
    events: replaceById(data.events, { ...event, status: "representative_arrived" }),
  };
  next = logActivity(next, {
    actor: user,
    action: "inspection.arrived",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: "representative_arrived",
  });
  return ok(next, { key: "checkedIn", values: { event: eventId } });
}

/** E2 "I can't attend — tell the coordinator". Status is unchanged; only the coordinator decides. */
export function reportCannotAttend({ data, user, now }: CommandContext, eventId: string): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "task.checkin", { kind: "event", event, rel }) || !rel.assignment) return fail("not_allowed");
  let next = logActivity(data, {
    actor: user,
    action: "field.cannot_attend",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: event.status,
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", rel.assignment.charityId).map((u) => u.id),
    "rep_cannot_attend",
    { event: eventId, rep: user.id },
    `/charity/tasks`,
    now,
  );
  return ok(next, { key: "cannotAttend", values: { event: eventId } });
}

/* ================================================================ E3: inspection */

export interface InspectionInput {
  outcome: InspectionOutcome | null;
  estimatedQuantity: number | null;
  unit: QuantityUnit | null;
  foodCondition: FoodCondition | null;
  packagingCondition: PackagingCondition | null;
  safetyChecklist: SafetyItem[];
  reason: OutcomeReason | null;
  notes: string | null;
}

/** Rules for a final inspection (blueprint UC-04, UC-08, §6). Returns field → error code. */
export function validateInspection(input: InspectionInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.outcome) {
    errors.outcome = "required";
    return errors;
  }
  if (input.outcome === "surplus_available") {
    if (!(input.estimatedQuantity !== null && input.estimatedQuantity > 0)) errors.estimatedQuantity = "required";
    if (!input.unit || !QUANTITY_UNITS.includes(input.unit)) errors.unit = "required";
    if (!input.foodCondition || !FOOD_CONDITIONS.includes(input.foodCondition)) errors.foodCondition = "required";
    if (!input.packagingCondition || !PACKAGING_CONDITIONS.includes(input.packagingCondition))
      errors.packagingCondition = "required";
  }
  if (input.outcome === "no_surplus" && !(NO_SURPLUS_REASONS as readonly string[]).includes(input.reason ?? ""))
    errors.reason = "required";
  if (
    input.outcome === "not_safe_to_collect" &&
    !(NOT_SUITABLE_REASONS as readonly string[]).includes(input.reason ?? "")
  )
    errors.reason = "required";
  return errors;
}

const OUTCOME_STATUS = {
  surplus_available: "inspected",
  no_surplus: "no_surplus",
  not_safe_to_collect: "not_collectable",
} as const;

/**
 * E3 save — "draft" keeps the visit open; "final" records the decision:
 * surplus → inspected (handover next) · no surplus → no_surplus · not suitable → not_collectable (reason required).
 * No received weight is ever created for "no surplus" (blueprint §6).
 */
export function saveInspection(
  { data, user, now }: CommandContext,
  eventId: string,
  input: InspectionInput,
  mode: "draft" | "final",
): CommandResult<"inspected" | "no_surplus" | "not_collectable" | "draft"> {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "inspection.record", { kind: "event", event, rel }) || !rel.assignment) return fail("not_allowed");
  const current = data.inspections.find(
    (i) => i.eventId === eventId && i.representativeId === user.id && i.status !== "final",
  );
  if (!current) return fail("invalid_state");

  const notes = input.notes?.trim() || null;
  const fields = {
    outcome: input.outcome,
    estimatedQuantity: input.outcome === "surplus_available" ? input.estimatedQuantity : null,
    unit: input.outcome === "surplus_available" ? input.unit : null,
    foodCondition: input.foodCondition,
    packagingCondition: input.packagingCondition,
    safetyChecklist: [...new Set(input.safetyChecklist)],
    reason: input.outcome === "surplus_available" ? null : input.reason,
    notes,
  };

  if (mode === "draft") {
    const next = {
      ...data,
      inspections: replaceById(data.inspections, { ...current, ...fields, status: "draft" as const }),
    };
    return ok(next, { key: "inspectionDraft", values: { event: eventId } }, "draft");
  }

  const errors = validateInspection(input);
  if (Object.keys(errors).length) return fail("validation", errors);
  const status = OUTCOME_STATUS[input.outcome!];
  let next = {
    ...data,
    inspections: replaceById(data.inspections, {
      ...current,
      ...fields,
      status: "final" as const,
      inspectedAt: now.toISOString(),
    }),
    events: replaceById(data.events, { ...event, status }),
    // A visit without surplus closes the task while keeping the visit record (UC-08).
    assignments:
      status === "inspected"
        ? data.assignments
        : replaceById(data.assignments, { ...rel.assignment, status: "completed" }),
  };
  next = logActivity(next, {
    actor: user,
    action: "inspection.recorded",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: status,
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", rel.assignment.charityId).map((u) => u.id),
    "inspection_result",
    { event: eventId, status },
    `/charity/tasks`,
    now,
  );
  return ok(next, { key: `inspection_${status}`, values: { event: eventId } }, status);
}

/* ================================================================ E4: provisional handover */

export interface HandoverInput {
  actualQuantity: number | null;
  unit: QuantityUnit | null;
  foodTypesText: string;
  handedOverAt: string;
  handedBy: string;
}

export function validateHandover(input: HandoverInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(input.actualQuantity !== null && input.actualQuantity > 0)) errors.actualQuantity = "required";
  if (!input.unit || !QUANTITY_UNITS.includes(input.unit)) errors.unit = "required";
  if (!input.foodTypesText.trim()) errors.foodTypesText = "required";
  if (!isIso(input.handedOverAt)) errors.handedOverAt = "required";
  if (!input.handedBy.trim()) errors.handedBy = "required";
  return errors;
}

/**
 * E4 "Record provisional handover". «تم الاستلام» completes only after the charity confirms (D5),
 * so the event stays "inspected". A disputed or pending record is replaced by the corrected one.
 */
export function recordHandover(
  { data, user, now }: CommandContext,
  eventId: string,
  input: HandoverInput,
): CommandResult<string> {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "handover.record", { kind: "event", event, rel }) || !rel.assignment) return fail("not_allowed");
  const inspection = data.inspections.find((i) => i.eventId === eventId && i.status === "final");
  if (inspection?.outcome !== "surplus_available") return fail("invalid_state");
  const existing = data.handovers.find((h) => h.eventId === eventId);
  if (existing && existing.confirmationStatus !== "pending" && existing.confirmationStatus !== "confirmed_by_hall")
    return fail("invalid_state");
  const errors = validateHandover(input);
  if (Object.keys(errors).length) return fail("validation", errors);

  const record = {
    id:
      existing?.id ??
      nextId(
        "HO",
        data.handovers.map((h) => h.id),
      ),
    eventId,
    inspectionId: inspection.id,
    actualQuantity: input.actualQuantity!,
    unit: input.unit!,
    handedOverAt: input.handedOverAt,
    receivingOrganizationId: rel.assignment.charityId,
    confirmationStatus: "pending" as const,
    foodTypesText: input.foodTypesText.trim(),
    handedBy: input.handedBy.trim(),
    recordedBy: user.id,
    charityConfirmedAt: null,
    hallConfirmedAt: null,
    dispute: null,
  };
  let next = { ...data, handovers: existing ? replaceById(data.handovers, record) : [...data.handovers, record] };
  next = logActivity(next, {
    actor: user,
    action: "handover.recorded",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: event.status,
  });
  const coordinators = usersOf(data, "charity_coordinator", rel.assignment.charityId).map((u) => u.id);
  next = notify(
    next,
    coordinators,
    "handover_recorded",
    { event: eventId, qty: record.actualQuantity },
    `/charity/handovers/${record.id}`,
    now,
  );
  next = notify(
    next,
    usersOf(data, "hall_manager", event.hallId).map((u) => u.id),
    "handover_recorded",
    { event: eventId, qty: record.actualQuantity },
    `/hall/events/${eventId}`,
    now,
  );
  return ok(next, { key: "handoverRecorded", values: { event: eventId } }, record.id);
}

/* ================================================================ report inspection (D7 step 3) */

export function recordReportResult(
  { data, user, now }: CommandContext,
  reportId: string,
  input: { outcome: "rescued" | "not_suitable" | null; actualKg: number | null; note: string | null },
): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.inspect", { kind: "report", report }) || !report.inspection) return fail("not_allowed");
  const errors: Record<string, string> = {};
  if (!input.outcome) errors.outcome = "required";
  if (input.outcome === "rescued" && !(input.actualKg !== null && input.actualKg > 0)) errors.actualKg = "required";
  const note = input.note?.trim() || null;
  if (input.outcome === "not_suitable" && !note) errors.note = "required";
  if (Object.keys(errors).length) return fail("validation", errors);

  const result = {
    outcome: input.outcome!,
    actualKg: input.outcome === "rescued" ? input.actualKg : null,
    note,
    at: now.toISOString(),
  };
  let next = {
    ...data,
    reports: replaceById(data.reports, { ...report, inspection: { ...report.inspection, result } }),
  };
  next = logActivity(next, {
    actor: user,
    action: "report.result_recorded",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: report.status,
    after: report.status,
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", report.charityId).map((u) => u.id),
    "report_result",
    { report: reportId, outcome: result.outcome },
    `/charity/reports/${reportId}`,
    now,
  );
  return ok(next, { key: "reportResult", values: { report: reportId } });
}
