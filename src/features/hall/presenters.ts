import type { ActivityLogEntry, DemoDataset, Handover, HallEvent } from "@/domain/types";

/**
 * Quantity column rule (Figma C1/B1): expected and actual quantities are separate fields and are never mixed
 * (blueprint §6). "No surplus" never shows a received weight; "not collectable" records nothing.
 */
export type QuantityMessage =
  | { key: "actual"; value: number }
  | { key: "estimate"; value: number }
  | { key: "notEstimated" }
  | { key: "noSurplus" }
  | { key: "notRecorded" };

export function quantityMessage(event: HallEvent, handover: Handover | undefined): QuantityMessage {
  if (event.status === "collected" && handover) return { key: "actual", value: handover.actualQuantity };
  if (event.status === "no_surplus") return { key: "noSurplus" };
  if (event.status === "not_collectable") return { key: "notRecorded" };
  if (event.expectedSurplusKg === null) return { key: "notEstimated" };
  return { key: "estimate", value: event.expectedSurplusKg };
}

/** Display name of the organisation behind an activity actor (e.g. the charity that expressed interest). */
export function actorOrganizationName(data: DemoDataset, entry: ActivityLogEntry, locale: "ar" | "en"): string {
  const user = data.users.find((u) => u.id === entry.actorUserId);
  const org = user?.organizationId ? data.organizations.find((o) => o.id === user.organizationId) : undefined;
  return org?.name[locale] ?? entry.actorUserId;
}

/**
 * Message key for an activity action. Domain actions use dots (`event.created`), but next-intl treats dots as
 * nesting, so the catalog stores them with underscores (`event_created`).
 */
export function activityMessageKey(action: ActivityLogEntry["action"]): string {
  return action.replace(/\./g, "_");
}
