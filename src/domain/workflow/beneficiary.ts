import { DEMO_CONFIG } from "@/config/demo";
import { can } from "../permissions";
import { listingAvailability, listingRemaining } from "../selectors/beneficiary";
import type { FoodRequest, LocalizedText, SurplusReport } from "../types";
import { fail, isIso, logActivity, nextId, notify, ok, replaceById, usersOf } from "./core";
import type { CommandContext, CommandResult } from "./core";

/* ================================================================ H2: request food */

/**
 * H2 "Send request" — never more than the remaining quantity or the per-request limit.
 * No points for sending (blueprint §2.1). One open request per listing and beneficiary.
 */
export function createRequest(
  { data, user, now }: CommandContext,
  listingId: string,
  units: number,
): CommandResult<string> {
  if (!can(user, "request.create")) return fail("not_allowed");
  const listing = data.listings.find((l) => l.id === listingId);
  if (!listing) return fail("not_found");
  if (listingAvailability(data, listing, now) === "sold_out" || listingAvailability(data, listing, now) === "ended")
    return fail("invalid_state");
  if (!Number.isInteger(units) || units < 1) return fail("validation", { units: "required" });
  if (units > listing.perRequestLimit) return fail("over_limit");
  if (units > listingRemaining(data, listing)) return fail("over_remaining");
  const open = data.requests.some(
    (r) =>
      r.listingId === listingId && r.beneficiaryId === user.id && ["pending", "accepted", "ready"].includes(r.status),
  );
  if (open) return fail("duplicate");

  const id = nextId(
    "R",
    data.requests.map((r) => r.id),
  );
  const request: FoodRequest = {
    id,
    listingId,
    beneficiaryId: user.id,
    units,
    status: "pending",
    createdAt: now.toISOString(),
    decidedAt: null,
    decidedBy: null,
    rejectReason: null,
    confirmation: null,
  };
  let next = { ...data, requests: [...data.requests, request] };
  next = logActivity(next, {
    actor: user,
    action: "request.created",
    entityType: "request",
    entityId: id,
    at: now,
    before: null,
    after: "pending",
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", listing.charityId).map((u) => u.id),
    "request_received",
    { request: id, listing: listingId },
    `/charity/listings/${listingId}`,
    now,
  );
  return ok(next, { key: "requestSent", values: { request: id } }, id);
}

/* ================================================================ H7: confirm pickup */

export interface ConfirmInput {
  kind: "full" | "partial" | "not_received";
  receivedUnits: number | null;
  rating: "excellent" | "good" | "needs_improvement" | null;
  note: string | null;
}

/**
 * H7 — full pickup completes the request and earns points once; partial records the received units
 * for the charity to review; "not received" records no distributed quantity and no points.
 */
export function confirmRequest(
  { data, user, now }: CommandContext,
  requestId: string,
  input: ConfirmInput,
): CommandResult {
  const request = data.requests.find((r) => r.id === requestId);
  const listing = request && data.listings.find((l) => l.id === request.listingId);
  if (!request || !listing) return fail("not_found");
  if (!can(user, "request.confirm", { kind: "request", request, listing })) return fail("not_allowed");

  let receivedUnits = 0;
  if (input.kind === "full") receivedUnits = request.units;
  if (input.kind === "partial") {
    const n = input.receivedUnits ?? 0;
    if (!Number.isInteger(n) || n < 1 || n >= request.units) return fail("validation", { receivedUnits: "range" });
    receivedUnits = n;
  }
  const status = input.kind === "full" ? "completed" : input.kind === "partial" ? "partial" : "not_received";
  let next = {
    ...data,
    requests: replaceById(data.requests, {
      ...request,
      status,
      confirmation: {
        kind: input.kind,
        receivedUnits,
        rating: input.rating,
        note: input.note?.trim() || null,
        at: now.toISOString(),
      },
    }),
  } as typeof data;
  const earned =
    input.kind === "full" && !data.points.some((p) => p.reason === "request_confirmed" && p.sourceId === requestId);
  if (earned) {
    next = {
      ...next,
      points: [
        ...next.points,
        {
          id: nextId(
            "P",
            next.points.map((p) => p.id),
          ),
          userId: user.id,
          points: DEMO_CONFIG.points.requestConfirmed,
          reason: "request_confirmed",
          sourceId: requestId,
          at: now.toISOString(),
        },
      ],
    };
  }
  next = logActivity(next, {
    actor: user,
    action: "request.confirmed",
    entityType: "request",
    entityId: requestId,
    at: now,
    before: request.status,
    after: status,
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", listing.charityId).map((u) => u.id),
    "request_confirmed",
    { request: requestId, status },
    `/charity/listings/${listing.id}`,
    now,
  );
  return ok(next, {
    key: `confirm_${input.kind}`,
    values: { request: requestId, points: earned ? DEMO_CONFIG.points.requestConfirmed : 0 },
  });
}

/* ================================================================ H4 / H8: surplus reports */

export interface ReportInput {
  foodType: string;
  estimatedQuantity: number | null;
  unit: SurplusReport["unit"] | null;
  readyAt: string;
  area: LocalizedText | null;
  notes: string;
  photoAttached: boolean;
}

export function validateReport(input: ReportInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.foodType.trim().length < 2) errors.foodType = "required";
  if (!(input.estimatedQuantity !== null && input.estimatedQuantity > 0)) errors.estimatedQuantity = "required";
  if (!input.unit) errors.unit = "required";
  if (!isIso(input.readyAt)) errors.readyAt = "required";
  if (!input.area) errors.area = "required";
  if (input.notes.trim().length > 300) errors.notes = "tooLong";
  return errors;
}

/** H4 — sent for review; never published as available food automatically; no points on sending. */
export function createReport({ data, user, now }: CommandContext, input: ReportInput): CommandResult<string> {
  if (!can(user, "report.create")) return fail("not_allowed");
  const errors = validateReport(input);
  if (Object.keys(errors).length) return fail("validation", errors);
  const id = nextId(
    "B",
    data.reports.map((r) => r.id),
  );
  const report: SurplusReport = {
    id,
    reporterId: user.id,
    charityId: DEMO_CONFIG.reportsCharityId,
    foodType: input.foodType.trim(),
    estimatedQuantity: input.estimatedQuantity!,
    unit: input.unit!,
    readyAt: input.readyAt,
    area: input.area!,
    notes: input.notes.trim() || null,
    photoAttached: input.photoAttached,
    status: "pending",
    createdAt: now.toISOString(),
    infoRequest: null,
    rejectReason: null,
    inspection: null,
    rescue: null,
  };
  let next = { ...data, reports: [...data.reports, report] };
  next = logActivity(next, {
    actor: user,
    action: "report.created",
    entityType: "report",
    entityId: id,
    at: now,
    before: null,
    after: "pending",
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", report.charityId).map((u) => u.id),
    "report_received",
    { report: id },
    `/charity/reports/${id}`,
    now,
  );
  return ok(next, { key: "reportSent", values: { report: id } }, id);
}

/** H8 "Add information" — back to review. */
export function answerReportInfo({ data, user, now }: CommandContext, reportId: string, answer: string): CommandResult {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) return fail("not_found");
  if (!can(user, "report.answer", { kind: "report", report }) || !report.infoRequest) return fail("not_allowed");
  const text = answer.trim();
  if (!text) return fail("validation", { answer: "required" });
  let next = {
    ...data,
    reports: replaceById(data.reports, {
      ...report,
      status: "pending",
      infoRequest: { ...report.infoRequest, answer: text, answeredAt: now.toISOString() },
    }),
  } as typeof data;
  next = logActivity(next, {
    actor: user,
    action: "report.info_added",
    entityType: "report",
    entityId: reportId,
    at: now,
    before: "needs_info",
    after: "pending",
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", report.charityId).map((u) => u.id),
    "report_info_added",
    { report: reportId },
    `/charity/reports/${reportId}`,
    now,
  );
  return ok(next, { key: "reportInfoAdded", values: { report: reportId } });
}

/* ================================================================ H6: tip pledge (no points) */

export function pledgeTip({ data, user, now }: CommandContext, tipId: string): CommandResult {
  if (user.role !== "beneficiary") return fail("not_allowed");
  if (data.pledges.some((p) => p.userId === user.id && p.tipId === tipId)) return ok(data, { key: "pledged" });
  return ok(
    { ...data, pledges: [...data.pledges, { userId: user.id, tipId, at: now.toISOString() }] },
    { key: "pledged" },
  );
}

/* ================================================================ notices (all roles) */

export function markNoticeRead({ data, user, now }: CommandContext, noticeId: string): CommandResult {
  const n = data.notices.find((x) => x.id === noticeId);
  if (!n || n.recipientUserId !== user.id) return fail("not_found");
  if (n.readAt) return ok(data);
  return ok({ ...data, notices: replaceById(data.notices, { ...n, readAt: now.toISOString() }) });
}

export function markAllNoticesRead({ data, user, now }: CommandContext): CommandResult {
  const at = now.toISOString();
  return ok({
    ...data,
    notices: data.notices.map((n) => (n.recipientUserId === user.id && !n.readAt ? { ...n, readAt: at } : n)),
  });
}
