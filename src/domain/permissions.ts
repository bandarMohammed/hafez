import { DEMO_CONFIG } from "@/config/demo";
import { getRoleConfig } from "./roles";
import type { DemoUser, HallEvent } from "./types";

/**
 * Central permission check — blueprint §2 & §11: `can(user, action, resource)`.
 * Components and services both call this; role rules must never be duplicated in UI code.
 *
 * ⚠️ Demo only: this runs in the browser against local data. It explains permissions visually
 * and is NOT a security boundary. Production requires server-side checks on every request.
 */
export type Action =
  "workspace.enter" | "event.list" | "event.view" | "event.create" | "event.edit" | "activity.view" | "demo.reset";

export type Resource = { kind: "workspace"; workspace: string } | { kind: "event"; event: HallEvent };

/** Scope of a single event per role (blueprint §2 "least privilege"). */
function canSeeEvent(user: DemoUser, event: HallEvent): boolean {
  switch (user.role) {
    case "admin":
    case "judge_viewer":
      return true;
    case "hall_manager":
      return event.hallId === user.organizationId;
    case "charity_coordinator":
      // Opportunities are visible once published — not while merely "registered".
      return event.status !== "registered";
    case "field_representative":
    case "beneficiary":
      // Field reps only see assigned tasks (assignments arrive with the E-screens); beneficiaries never see events.
      return false;
  }
}

export function can(user: DemoUser | null | undefined, action: Action, resource?: Resource): boolean {
  if (!user) return false;
  const event = resource?.kind === "event" ? resource.event : undefined;

  switch (action) {
    case "workspace.enter":
      return resource?.kind === "workspace" && getRoleConfig(user.role).workspace === resource.workspace;

    case "event.list":
      return user.role !== "beneficiary";

    case "event.view":
    case "activity.view":
      return event ? canSeeEvent(user, event) : false;

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
  }
}
