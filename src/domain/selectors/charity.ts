import { can, eventRelations } from "../permissions";
import type { Assignment, DemoDataset, DemoUser, Handover, HallEvent } from "../types";
import { listedKgFromHandover } from "./beneficiary";

const time = (iso: string) => Date.parse(iso);

/** D1 — published opportunities in range + the ones this charity expressed interest in (awaiting assignment). */
export function selectOpportunities(data: DemoDataset, user: DemoUser): HallEvent[] {
  return data.events
    .filter((e) => {
      const rel = eventRelations(data, e, user);
      if (!can(user, "event.view", { kind: "event", event: e, rel })) return false;
      return e.status === "available" || (e.status === "awaiting_charity" && rel.coordination?.status === "interested");
    })
    .sort((a, b) => time(a.foodReadyAt) - time(b.foodReadyAt));
}

export interface CharityTask {
  event: HallEvent;
  assignment: Assignment | null;
}

/** "Tasks & team" — events needing a representative, then active assignments, then completed ones. */
export function selectCharityTasks(data: DemoDataset, charityId: string) {
  const ofCharity = (e: HallEvent) =>
    data.coordination.some((c) => c.eventId === e.id && c.charityId === charityId && c.status !== "declined");
  const events = data.events.filter(ofCharity);
  const assignmentOf = (e: HallEvent) =>
    data.assignments
      .filter((a) => a.eventId === e.id && a.charityId === charityId)
      .sort((a, b) => time(b.assignedAt) - time(a.assignedAt))[0] ?? null;
  const toTask = (e: HallEvent): CharityTask => ({ event: e, assignment: assignmentOf(e) });
  const byReady = (a: CharityTask, b: CharityTask) => time(a.event.foodReadyAt) - time(b.event.foodReadyAt);
  return {
    needsAssignment: events
      .filter((e) => e.status === "awaiting_charity")
      .map(toTask)
      .sort(byReady),
    active: events
      .filter((e) => ["assigned", "representative_arrived", "inspected"].includes(e.status))
      .map(toTask)
      .sort(byReady),
    finished: events
      .filter((e) => ["collected", "no_surplus", "not_collectable", "closed"].includes(e.status))
      .map(toTask)
      .sort((a, b) => time(b.event.foodReadyAt) - time(a.event.foodReadyAt)),
  };
}

export interface TeamMember {
  user: DemoUser;
  /** Active tasks planned on the given calendar day (Asia/Riyadh). */
  tasksOnDay: number;
  availableUntil: string | null;
}

const riyadhDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/** D4 — the charity's own field team with their load on the event day. */
export function selectTeam(data: DemoDataset, charityId: string, dayIso: string): TeamMember[] {
  const day = riyadhDay(dayIso);
  return data.users
    .filter((u) => u.role === "field_representative" && u.organizationId === charityId)
    .map((u) => ({
      user: u,
      tasksOnDay: data.assignments.filter(
        (a) => a.representativeId === u.id && a.status === "active" && riyadhDay(a.plannedArrivalAt) === day,
      ).length,
      availableUntil: u.availableUntil ?? null,
    }));
}

/** D5 — handovers received by this charity: waiting for confirmation first, then confirmed ones. */
export function selectCharityHandovers(data: DemoDataset, charityId: string) {
  const mine = data.handovers.filter((h) => h.receivingOrganizationId === charityId);
  const eventOf = (h: Handover) => data.events.find((e) => e.id === h.eventId)!;
  return {
    pending: mine
      .filter((h) => eventOf(h).status === "inspected")
      .sort((a, b) => time(b.handedOverAt) - time(a.handedOverAt)),
    confirmed: mine
      .filter((h) => eventOf(h).status !== "inspected")
      .sort((a, b) => time(b.handedOverAt) - time(a.handedOverAt)),
  };
}

/** D6 — documented handovers (collected) that still have kg not yet packaged into a listing. */
export function selectListableHandovers(data: DemoDataset, charityId: string) {
  return data.handovers
    .filter((h) => {
      const e = data.events.find((x) => x.id === h.eventId);
      return h.receivingOrganizationId === charityId && (e?.status === "collected" || e?.status === "closed");
    })
    .map((h) => ({ handover: h, availableKg: Math.max(0, h.actualQuantity - listedKgFromHandover(data, h.id)) }))
    .filter((x) => x.availableKg > 0);
}

export function selectCharityListings(data: DemoDataset, charityId: string) {
  return data.listings
    .filter((l) => l.charityId === charityId)
    .sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
}

/** D6 requests on one listing: pending first (newest first), then decided. */
export function selectListingRequests(data: DemoDataset, listingId: string) {
  const order = {
    pending: 0,
    accepted: 1,
    ready: 1,
    partial: 2,
    completed: 2,
    not_received: 3,
    rejected: 4,
    cancelled: 5,
  } as const;
  return data.requests
    .filter((r) => r.listingId === listingId)
    .sort((a, b) => order[a.status] - order[b.status] || time(b.createdAt) - time(a.createdAt));
}

/** D7 — reports routed to this charity: pending first, then needs info, accepted, closed. */
export function selectCharityReports(data: DemoDataset, charityId: string) {
  const order = { pending: 0, needs_info: 1, accepted: 2, coordinated: 3, rejected: 4 } as const;
  return data.reports
    .filter((r) => r.charityId === charityId)
    .sort((a, b) => order[a.status] - order[b.status] || time(b.createdAt) - time(a.createdAt));
}

/**
 * D4 planned-arrival options: every 15 minutes from one hour before to one hour after the food-ready time
 * (Figma: "23:15 — قبل الجاهزية بـ 15 دقيقة"). Returned as ISO instants with the minutes offset to ready time.
 */
export function arrivalOptions(foodReadyAt: string): Array<{ iso: string; offsetMin: number }> {
  const ready = Date.parse(foodReadyAt);
  const out: Array<{ iso: string; offsetMin: number }> = [];
  for (let m = -60; m <= 60; m += 15) out.push({ iso: new Date(ready + m * 60_000).toISOString(), offsetMin: m });
  return out;
}

/** When an event became an opportunity (its latest move to "available"), for "نُشرت اليوم 19:10" (Figma D2). */
export function publishedAt(data: DemoDataset, event: HallEvent): string {
  const entry = data.activity
    .filter((a) => a.entityType === "event" && a.entityId === event.id && a.after === "available")
    .sort((a, b) => time(b.timestamp) - time(a.timestamp))[0];
  return entry?.timestamp ?? event.forecast?.decidedAt ?? event.createdAt;
}
