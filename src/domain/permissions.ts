import { DEMO_CONFIG } from "@/config/demo";
import { getRoleConfig } from "./roles";
import type {
  Assignment,
  CoordinationRequest,
  DemoDataset,
  DemoUser,
  FoodListing,
  FoodRequest,
  Handover,
  HallEvent,
  SurplusReport,
} from "./types";

/**
 * Central permission check — blueprint §2 & §11: `can(user, action, resource)`.
 * Components and workflow commands both call this; role rules must never be duplicated in UI code.
 *
 * ⚠️ Demo only: this runs in the browser against local data. It explains permissions visually
 * and is NOT a security boundary. Production requires server-side checks on every request.
 */
export type Action =
  | "workspace.enter"
  | "event.list"
  | "event.view"
  | "event.create"
  | "event.edit"
  | "activity.view"
  | "demo.reset"
  // charity coordinator (D)
  | "coordination.express"
  | "coordination.decline"
  | "assignment.create"
  | "handover.confirm_charity"
  | "handover.dispute"
  | "listing.publish"
  | "request.decide"
  | "report.review"
  // hall (C)
  | "handover.confirm_hall"
  // field representative (E)
  | "task.checkin"
  | "inspection.record"
  | "handover.record"
  | "report.inspect"
  // beneficiary (H)
  | "request.create"
  | "request.confirm"
  | "report.create"
  | "report.answer";

/** How an event relates to the current user (looked up once by `eventRelations`). */
export interface EventRelations {
  /** Coordination record of the user's charity on this event, if any. */
  coordination?: CoordinationRequest;
  /** Assignment of this event to the user (field representative), if any. */
  assignment?: Assignment;
}

export type Resource =
  | { kind: "workspace"; workspace: string }
  | { kind: "event"; event: HallEvent; rel?: EventRelations }
  | { kind: "handover"; handover: Handover; event: HallEvent; rel?: EventRelations }
  | { kind: "listing"; listing: FoodListing }
  | { kind: "request"; request: FoodRequest; listing: FoodListing }
  | { kind: "report"; report: SurplusReport };

export function eventRelations(data: DemoDataset, event: HallEvent, user: DemoUser): EventRelations {
  return {
    coordination: user.organizationId
      ? data.coordination.find((c) => c.eventId === event.id && c.charityId === user.organizationId)
      : undefined,
    assignment: data.assignments.find((a) => a.eventId === event.id && a.representativeId === user.id),
  };
}

/** Scope of a single event per role (blueprint §2 "least privilege"). */
function canSeeEvent(user: DemoUser, event: HallEvent, rel: EventRelations = {}): boolean {
  switch (user.role) {
    case "admin":
    case "judge_viewer":
      return true;
    case "hall_manager":
      return event.hallId === user.organizationId;
    case "charity_coordinator":
      // Published opportunities for every charity in range; afterwards only the charity coordinating it.
      // A charity that declined an opportunity no longer sees it (Figma D3: the event is not deleted).
      if (rel.coordination) return rel.coordination.status !== "declined";
      return event.status === "available";
    case "field_representative":
      // Only tasks assigned to them (blueprint: "لا يرى جميع المناسبات").
      return rel.assignment?.representativeId === user.id;
    case "beneficiary":
      return false;
  }
}

const isCoordinatorOf = (user: DemoUser, charityId: string) =>
  user.role === "charity_coordinator" && user.organizationId === charityId;

export function can(user: DemoUser | null | undefined, action: Action, resource?: Resource): boolean {
  if (!user) return false;
  const event = resource && "event" in resource ? resource.event : undefined;
  const rel = resource && "rel" in resource ? (resource.rel ?? {}) : {};

  switch (action) {
    case "workspace.enter":
      return resource?.kind === "workspace" && getRoleConfig(user.role).workspace === resource.workspace;

    case "event.list":
      return user.role !== "beneficiary";

    case "event.view":
    case "activity.view":
      return event ? canSeeEvent(user, event, rel) : false;

    case "event.create":
      return user.role === "admin" || user.role === "hall_manager";

    case "event.edit":
      if (!event) return false;
      if (user.role === "admin") return true;
      return (
        user.role === "hall_manager" &&
        event.hallId === user.organizationId &&
        DEMO_CONFIG.hallEditableStatuses.includes(event.status)
      );

    case "demo.reset":
      return user.role === "admin";

    /* ---------------------------------------------------------------- charity */
    case "coordination.express":
      return user.role === "charity_coordinator" && event?.status === "available" && !rel.coordination;

    case "coordination.decline":
      if (user.role !== "charity_coordinator" || !event) return false;
      if (!rel.coordination) return event.status === "available";
      return rel.coordination.status === "interested" && event.status === "awaiting_charity";

    case "assignment.create":
      return (
        (user.role === "charity_coordinator" || user.role === "admin") &&
        event?.status === "awaiting_charity" &&
        rel.coordination?.status === "interested"
      );

    case "handover.confirm_charity":
    case "handover.dispute":
      return (
        resource?.kind === "handover" &&
        isCoordinatorOf(user, resource.handover.receivingOrganizationId) &&
        resource.event.status === "inspected" &&
        (resource.handover.confirmationStatus === "pending" ||
          resource.handover.confirmationStatus === "confirmed_by_hall")
      );

    case "listing.publish":
      return user.role === "charity_coordinator";

    case "request.decide":
      return (
        resource?.kind === "request" &&
        isCoordinatorOf(user, resource.listing.charityId) &&
        resource.request.status === "pending"
      );

    case "report.review":
      return resource?.kind === "report" && isCoordinatorOf(user, resource.report.charityId);

    /* ---------------------------------------------------------------- hall */
    case "handover.confirm_hall":
      return (
        resource?.kind === "handover" &&
        user.role === "hall_manager" &&
        resource.event.hallId === user.organizationId &&
        !resource.handover.hallConfirmedAt &&
        !resource.handover.dispute
      );

    /* ---------------------------------------------------------------- field representative */
    case "task.checkin":
      return (
        user.role === "field_representative" &&
        rel.assignment?.status === "active" &&
        rel.assignment.representativeId === user.id &&
        event?.status === "assigned"
      );

    case "inspection.record":
      return (
        user.role === "field_representative" &&
        rel.assignment?.status === "active" &&
        rel.assignment.representativeId === user.id &&
        event?.status === "representative_arrived"
      );

    case "handover.record":
      return (
        user.role === "field_representative" &&
        rel.assignment?.status === "active" &&
        rel.assignment.representativeId === user.id &&
        event?.status === "inspected"
      );

    case "report.inspect":
      return (
        resource?.kind === "report" &&
        user.role === "field_representative" &&
        resource.report.status === "accepted" &&
        resource.report.inspection?.representativeId === user.id &&
        !resource.report.inspection.result
      );

    /* ---------------------------------------------------------------- beneficiary */
    case "request.create":
      return user.role === "beneficiary";

    case "request.confirm":
      return (
        resource?.kind === "request" &&
        resource.request.beneficiaryId === user.id &&
        (resource.request.status === "accepted" || resource.request.status === "ready")
      );

    case "report.create":
      return user.role === "beneficiary";

    case "report.answer":
      return (
        resource?.kind === "report" && resource.report.reporterId === user.id && resource.report.status === "needs_info"
      );
  }
}
