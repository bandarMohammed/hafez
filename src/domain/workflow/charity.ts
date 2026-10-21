import { DEMO_CONFIG } from "@/config/demo";
import { can, eventRelations } from "../permissions";
import { listingRemaining, listedKgFromHandover } from "../selectors/beneficiary";
import type { DeclineReason, FoodListing, ListingCategory, LocalizedText, RequestRejectReason } from "../types";
import { fail, isIso, logActivity, nextId, notify, ok, replaceById, usersOf } from "./core";
import type { CommandContext, CommandResult } from "./core";

/* ================================================================ D1–D4: opportunities & assignment */

/** D2 "Express interest" — available → awaiting_charity (blueprint §6). */
export function expressInterest({ data, user, now }: CommandContext, eventId: string): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "coordination.express", { kind: "event", event, rel })) return fail("not_allowed");

  let next = {
    ...data,
    coordination: [
      ...data.coordination,
      {
        id: nextId(
          "CR",
          data.coordination.map((c) => c.id),
        ),
        eventId,
        charityId: user.organizationId!,
        coordinatorId: user.id,
        status: "interested" as const,
        reason: null,
        note: null,
        createdAt: now.toISOString(),
        decidedAt: null,
      },
    ],
    events: replaceById(data.events, { ...event, status: "awaiting_charity" }),
  };
  next = logActivity(next, {
    actor: user,
    action: "coordination.interest",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: "awaiting_charity",
  });
  next = notify(
    next,
    usersOf(data, "hall_manager", event.hallId).map((u) => u.id),
    "coordination_interest",
    { event: eventId, charity: user.organizationId! },
    `/hall/events/${eventId}`,
    now,
  );
  return ok(next, { key: "interest", values: { event: eventId } });
}

/** D3 "Decline" — the reason is optional; the event is not deleted and returns to the pool. */
export function declineOpportunity(
  { data, user, now }: CommandContext,
  eventId: string,
  input: { reason: DeclineReason | null; note: string | null },
): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "coordination.decline", { kind: "event", event, rel })) return fail("not_allowed");
  const note = input.note?.trim() || null;
  if (input.reason === "other" && !note) return fail("validation", { note: "required" });

  const decided = { reason: input.reason, note, decidedAt: now.toISOString(), status: "declined" as const };
  let next = { ...data };
  if (rel.coordination) {
    next.coordination = replaceById(data.coordination, { ...rel.coordination, ...decided });
  } else {
    next.coordination = [
      ...data.coordination,
      {
        id: nextId(
          "CR",
          data.coordination.map((c) => c.id),
        ),
        eventId,
        charityId: user.organizationId!,
        coordinatorId: user.id,
        createdAt: now.toISOString(),
        ...decided,
      },
    ];
  }
  const after = event.status === "awaiting_charity" ? "available" : event.status;
  if (after !== event.status) next.events = replaceById(data.events, { ...event, status: after });
  next = logActivity(next, {
    actor: user,
    action: "coordination.declined",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after,
  });
  // "Helps the admin suggest another charity" (Figma D3).
  next = notify(
    next,
    usersOf(data, "admin").map((u) => u.id),
    "coordination_declined",
    { event: eventId, charity: user.organizationId! },
    null,
    now,
  );
  return ok(next, { key: "declined", values: { event: eventId } });
}

/** D4 "Assign representative" — awaiting_charity → assigned. The task appears to that representative only. */
export function assignRepresentative(
  { data, user, now }: CommandContext,
  eventId: string,
  input: { representativeId: string; plannedArrivalAt: string },
): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  const rel = eventRelations(data, event, user);
  if (!can(user, "assignment.create", { kind: "event", event, rel }) || !rel.coordination) return fail("not_allowed");
  const errors: Record<string, string> = {};
  const rep = data.users.find((u) => u.id === input.representativeId);
  if (!rep) errors.representativeId = "required";
  else if (rep.role !== "field_representative" || rep.organizationId !== rel.coordination.charityId)
    errors.representativeId = "not_in_team";
  if (!isIso(input.plannedArrivalAt)) errors.plannedArrivalAt = "required";
  if (Object.keys(errors).length) return fail("validation", errors);

  let next = {
    ...data,
    assignments: [
      ...data.assignments,
      {
        id: nextId(
          "AS",
          data.assignments.map((a) => a.id),
        ),
        eventId,
        charityId: rel.coordination.charityId,
        representativeId: input.representativeId,
        plannedArrivalAt: input.plannedArrivalAt,
        assignedBy: user.id,
        assignedAt: now.toISOString(),
        status: "active" as const,
      },
    ],
    coordination: replaceById(data.coordination, {
      ...rel.coordination,
      status: "assigned",
      decidedAt: now.toISOString(),
    }),
    events: replaceById(data.events, { ...event, status: "assigned" }),
  };
  next = logActivity(next, {
    actor: user,
    action: "assignment.created",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: "assigned",
  });
  next = notify(
    next,
    [input.representativeId],
    "task_assigned",
    { event: eventId, time: input.plannedArrivalAt },
    `/field/tasks/${eventId}`,
    now,
  );
  return ok(next, { key: "assigned", values: { event: eventId } });
}

/* ================================================================ D5: handover confirmation */

/** D5 "Confirm charity receipt" — completes «تم الاستلام» (inspected → collected). */
export function confirmHandoverByCharity({ data, user, now }: CommandContext, handoverId: string): CommandResult {
  const handover = data.handovers.find((h) => h.id === handoverId);
  const event = handover && data.events.find((e) => e.id === handover.eventId);
  if (!handover || !event) return fail("not_found");
  if (!can(user, "handover.confirm_charity", { kind: "handover", handover, event })) return fail("not_allowed");
  // Blueprint §6: never "collected" without actual quantity, unit, time and receiving organisation.
  if (!(handover.actualQuantity > 0) || !handover.unit || !handover.handedOverAt || !handover.receivingOrganizationId)
    return fail("invalid_state");

  const confirmationStatus = handover.hallConfirmedAt ? "confirmed_by_both" : "confirmed_by_charity";
  let next = {
    ...data,
    handovers: replaceById(data.handovers, {
      ...handover,
      confirmationStatus,
      charityConfirmedAt: now.toISOString(),
      dispute: null,
    }),
    events: replaceById(data.events, { ...event, status: "collected" }),
    assignments: data.assignments.map((a) =>
      a.eventId === event.id && a.status === "active" ? { ...a, status: "completed" as const } : a,
    ),
  };
  next = logActivity(next, {
    actor: user,
    action: "handover.confirmed",
    entityType: "event",
    entityId: event.id,
    at: now,
    before: event.status,
    after: "collected",
  });
  const reps = data.assignments.filter((a) => a.eventId === event.id).map((a) => a.representativeId);
  next = notify(
    next,
    reps,
    "handover_confirmed",
    { event: event.id, qty: handover.actualQuantity },
    `/field/tasks/${event.id}`,
    now,
  );
  next = notify(
    next,
    usersOf(data, "hall_manager", event.hallId).map((u) => u.id),
    "handover_confirmed",
    { event: event.id, qty: handover.actualQuantity },
    `/hall/events/${event.id}`,
    now,
  );
  return ok(next, { key: "handoverConfirmed", values: { event: event.id, qty: handover.actualQuantity } });
}

/** D5 "Report a quantity difference" — the status does not change; the representative is told to correct it. */
export function disputeHandover({ data, user, now }: CommandContext, handoverId: string, note: string): CommandResult {
  const handover = data.handovers.find((h) => h.id === handoverId);
  const event = handover && data.events.find((e) => e.id === handover.eventId);
  if (!handover || !event) return fail("not_found");
  if (!can(user, "handover.dispute", { kind: "handover", handover, event })) return fail("not_allowed");
  const text = note.trim();
  if (!text) return fail("validation", { note: "required" });

  let next = {
    ...data,
    handovers: replaceById(data.handovers, { ...handover, dispute: { note: text, at: now.toISOString() } }),
  };
  next = logActivity(next, {
    actor: user,
    action: "handover.disputed",
    entityType: "event",
    entityId: event.id,
    at: now,
    before: event.status,
    after: event.status,
  });
  const reps = data.assignments
    .filter((a) => a.eventId === event.id && a.status === "active")
    .map((a) => a.representativeId);
  next = notify(next, reps, "handover_disputed", { event: event.id }, `/field/tasks/${event.id}/handover`, now);
  return ok(next, { key: "handoverDisputed", values: { event: event.id } });
}

/* ================================================================ D6: listings & beneficiary requests */

export interface ListingInput {
  sourceHandoverId: string;
  title: string;
  category: ListingCategory;
  unitLabel: "box" | "bag";
  unitKg: number;
  totalUnits: number;
  perRequestLimit: number;
  area: LocalizedText;
  pickupStart: string;
  pickupEnd: string;
}

/** D6 "Publish a listing from a documented handover" — only collected handovers of this charity. */
export function publishListing({ data, user, now }: CommandContext, input: ListingInput): CommandResult<string> {
  if (!can(user, "listing.publish")) return fail("not_allowed");
  const handover = data.handovers.find((h) => h.id === input.sourceHandoverId);
  const event = handover && data.events.find((e) => e.id === handover.eventId);
  const errors: Record<string, string> = {};
  if (!handover || !event || handover.receivingOrganizationId !== user.organizationId)
    errors.sourceHandoverId = "required";
  else if (event.status !== "collected" && event.status !== "closed") errors.sourceHandoverId = "not_documented";
  const title = input.title.trim();
  if (title.length < 3) errors.title = "required";
  if (!(input.unitKg > 0)) errors.unitKg = "required";
  if (!Number.isInteger(input.totalUnits) || input.totalUnits < 1) errors.totalUnits = "required";
  if (!Number.isInteger(input.perRequestLimit) || input.perRequestLimit < 1) errors.perRequestLimit = "required";
  else if (input.perRequestLimit > input.totalUnits) errors.perRequestLimit = "over_total";
  if (!input.area.ar && !input.area.en) errors.area = "required";
  if (!isIso(input.pickupStart)) errors.pickupStart = "required";
  if (!isIso(input.pickupEnd)) errors.pickupEnd = "required";
  else if (isIso(input.pickupStart) && Date.parse(input.pickupEnd) <= Date.parse(input.pickupStart))
    errors.pickupEnd = "before_start";
  if (handover && !errors.totalUnits && !errors.unitKg) {
    const available = handover.actualQuantity - listedKgFromHandover(data, handover.id);
    if (input.totalUnits * input.unitKg > available + 1e-9) errors.totalUnits = "over_handover";
  }
  if (Object.keys(errors).length) return fail("validation", errors);

  const id = nextId(
    "L",
    data.listings.map((l) => l.id),
  );
  const listing: FoodListing = {
    id,
    charityId: user.organizationId!,
    sourceHandoverId: input.sourceHandoverId,
    title: { ar: title, en: title },
    category: input.category,
    unitLabel: input.unitLabel,
    unitKg: input.unitKg,
    totalUnits: input.totalUnits,
    perRequestLimit: input.perRequestLimit,
    area: input.area,
    pickupStart: input.pickupStart,
    pickupEnd: input.pickupEnd,
    publishedAt: now.toISOString(),
    publishedBy: user.id,
    status: "active",
  };
  let next = { ...data, listings: [...data.listings, listing] };
  next = logActivity(next, {
    actor: user,
    action: "listing.published",
    entityType: "listing",
    entityId: id,
    at: now,
    before: null,
    after: "active",
  });
  return ok(next, { key: "listingPublished", values: { listing: id } }, id);
}

/** D6 accept / reject — accepted units are deducted from what remains; pending ones are not. */
export function decideRequest(
  { data, user, now }: CommandContext,
  requestId: string,
  decision: { accept: true } | { accept: false; reason: RequestRejectReason },
): CommandResult {
  const request = data.requests.find((r) => r.id === requestId);
  const listing = request && data.listings.find((l) => l.id === request.listingId);
  if (!request || !listing) return fail("not_found");
  if (!can(user, "request.decide", { kind: "request", request, listing })) return fail("not_allowed");

  if (decision.accept) {
    if (request.units > listing.perRequestLimit) return fail("over_limit");
    if (request.units > listingRemaining(data, listing)) return fail("over_remaining");
  }
  // The listing already has a pickup window, so an accepted request is ready for pickup (Figma H3 R-07).
  const status = decision.accept ? "ready" : "rejected";
  let next = {
    ...data,
    requests: replaceById(data.requests, {
      ...request,
      status,
      decidedAt: now.toISOString(),
      decidedBy: user.id,
      rejectReason: decision.accept ? null : decision.reason,
    }),
  } as typeof data;
  next = logActivity(next, {
    actor: user,
    action: decision.accept ? "request.accepted" : "request.rejected",
    entityType: "request",
    entityId: requestId,
    at: now,
    before: request.status,
    after: status,
  });
  next = notify(
    next,
    [request.beneficiaryId],
    decision.accept ? "request_accepted" : "request_rejected",
    { request: requestId },
    "/beneficiary/requests",
    now,
  );
  return ok(next, { key: decision.accept ? "requestAccepted" : "requestRejected", values: { request: requestId } });
}

/* ================================================================ D7: beneficiary surplus reports */

export function acceptReport(
  { data, user, now }: CommandContext,
  reportId: string,
  input: { representativeId: string; plannedAt: string },
): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.review", { kind: "report", report })) return fail("not_allowed");
  if (report.status !== "pending" && report.status !== "needs_info") return fail("invalid_state");
  const errors: Record<string, string> = {};
  const rep = data.users.find((u) => u.id === input.representativeId);
  if (!rep || rep.role !== "field_representative" || rep.organizationId !== report.charityId)
    errors.representativeId = "required";
  if (!isIso(input.plannedAt)) errors.plannedAt = "required";
  if (Object.keys(errors).length) return fail("validation", errors);

  let next = {
    ...data,
    reports: replaceById(data.reports, {
      ...report,
      status: "accepted",
      inspection: {
        representativeId: input.representativeId,
        plannedAt: input.plannedAt,
        assignedAt: now.toISOString(),
        result: null,
      },
    }),
  } as typeof data;
  next = logActivity(next, {
    actor: user,
    action: "report.accepted",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: report.status,
    after: "accepted",
  });
  next = notify(next, [report.reporterId], "report_accepted", { report: reportId }, "/beneficiary/reports", now);
  next = notify(
    next,
    [input.representativeId],
    "report_inspection_assigned",
    { report: reportId, time: input.plannedAt },
    `/field/reports/${reportId}`,
    now,
  );
  return ok(next, { key: "reportAccepted", values: { report: reportId } });
}

export function requestReportInfo(
  { data, user, now }: CommandContext,
  reportId: string,
  question: string,
): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.review", { kind: "report", report })) return fail("not_allowed");
  if (report.status !== "pending") return fail("invalid_state");
  const q = question.trim();
  if (!q) return fail("validation", { question: "required" });
  let next = {
    ...data,
    reports: replaceById(data.reports, {
      ...report,
      status: "needs_info",
      infoRequest: { question: q, at: now.toISOString(), answer: null, answeredAt: null },
    }),
  } as typeof data;
  next = logActivity(next, {
    actor: user,
    action: "report.info_requested",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: report.status,
    after: "needs_info",
  });
  next = notify(next, [report.reporterId], "report_info_requested", { report: reportId }, "/beneficiary/reports", now);
  return ok(next, { key: "reportInfoRequested", values: { report: reportId } });
}

/** Reject with a reason — allowed during review, or after an inspection found the food unsuitable. */
export function rejectReport({ data, user, now }: CommandContext, reportId: string, reason: string): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.review", { kind: "report", report })) return fail("not_allowed");
  const afterUnsuitable = report.status === "accepted" && report.inspection?.result?.outcome === "not_suitable";
  if (report.status !== "pending" && report.status !== "needs_info" && !afterUnsuitable) return fail("invalid_state");
  const text = reason.trim();
  if (!text) return fail("validation", { reason: "required" });
  let next = {
    ...data,
    reports: replaceById(data.reports, { ...report, status: "rejected", rejectReason: text }),
  } as typeof data;
  next = logActivity(next, {
    actor: user,
    action: "report.rejected",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: report.status,
    after: "rejected",
  });
  next = notify(next, [report.reporterId], "report_rejected", { report: reportId }, "/beneficiary/reports", now);
  return ok(next, { key: "reportRejected", values: { report: reportId } });
}

/**
 * D7 step 4 "Document the rescue" — only after the representative recorded a rescued quantity.
 * Then the rescued quantity counts in impact and the reporter earns points, once.
 */
export function documentRescue({ data, user, now }: CommandContext, reportId: string): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.review", { kind: "report", report })) return fail("not_allowed");
  const result = report.inspection?.result;
  if (report.status !== "accepted" || result?.outcome !== "rescued" || !result.actualKg) return fail("invalid_state");

  let next = {
    ...data,
    reports: replaceById(data.reports, {
      ...report,
      status: "coordinated",
      rescue: { actualKg: result.actualKg, documentedAt: now.toISOString(), documentedBy: user.id },
    }),
  } as typeof data;
  if (!data.points.some((p) => p.reason === "report_rescued" && p.sourceId === reportId)) {
    next = {
      ...next,
      points: [
        ...next.points,
        {
          id: nextId(
            "P",
            next.points.map((p) => p.id),
          ),
          userId: report.reporterId,
          points: DEMO_CONFIG.points.reportRescued,
          reason: "report_rescued",
          sourceId: reportId,
          at: now.toISOString(),
        },
      ],
    };
  }
  next = logActivity(next, {
    actor: user,
    action: "report.rescued",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: report.status,
    after: "coordinated",
  });
  next = notify(
    next,
    [report.reporterId],
    "report_rescued",
    { report: reportId, qty: result.actualKg },
    "/beneficiary/shield",
    now,
  );
  return ok(next, { key: "reportRescued", values: { report: reportId, qty: result.actualKg } });
}
