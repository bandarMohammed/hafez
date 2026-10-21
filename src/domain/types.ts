/**
 * Domain types — mirror the data model in docs/Hafez_Product_Blueprint_Updated.html §7 (v1.1).
 * Only the entities needed by the implemented screens are modelled here; the rest are added with their screens.
 */

export const ROLES = [
  "admin",
  "hall_manager",
  "charity_coordinator",
  "field_representative",
  "judge_viewer",
  "beneficiary",
] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_STATUSES = [
  "registered",
  "available",
  "awaiting_charity",
  "assigned",
  "representative_arrived",
  "inspected",
  "collected",
  "no_surplus",
  "not_collectable",
  "closed",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Data content is stored in both languages; UI strings live in src/messages. */
export interface LocalizedText {
  ar: string;
  en: string;
}

export type OrganizationType = "platform" | "hall" | "charity" | "observer";

export interface Organization {
  id: string;
  type: OrganizationType;
  name: LocalizedText;
  city: LocalizedText;
  district: LocalizedText | null;
}

export interface DemoUser {
  id: string;
  role: Role;
  organizationId: string | null;
  initials: LocalizedText;
}

/** Food categories a hall can declare for an event (C2). Labels live in src/messages (newEvent.foodTypes). */
export const FOOD_TYPES = ["hot_meals", "rice_dishes", "salads", "desserts", "bakery", "fruit"] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

export interface HallEvent {
  id: string;
  hallId: string;
  title: LocalizedText;
  /** ISO 8601 with offset — event start. Event time, food-ready time and inspection time are separate fields. */
  eventDate: string;
  foodReadyAt: string;
  expectedGuests: number;
  /** Hall's estimate only — never shown as received quantity. `null` = not estimated yet. */
  expectedSurplusKg: number | null;
  status: EventStatus;
  createdAt: string;
  createdBy: string;
  /*
   * Fields captured by the C2 form. Optional because the older seed events were registered before C2
   * existed (the blueprint keeps them minimal). User-entered text is stored as typed — not translated.
   */
  /** ISO 8601 — event end. Separate from `foodReadyAt` (blueprint: never merge the two times). */
  endsAt?: string;
  /** Planned food quantity prepared by the hall (kg). Input for the C3 forecast; not a surplus. */
  plannedQuantityKg?: number;
  foodTypes?: FoodType[];
  contactName?: string;
  /** Illustrative demo value — not called by the system. */
  contactPhone?: string;
  notes?: string | null;
}

export type QuantityUnit = "kg" | "meal_portions" | "boxes";
export type ConfirmationStatus = "pending" | "confirmed_by_charity" | "confirmed_by_hall" | "confirmed_by_both";

export interface Handover {
  id: string;
  eventId: string;
  actualQuantity: number;
  unit: QuantityUnit;
  handedOverAt: string;
  receivingOrganizationId: string;
  confirmationStatus: ConfirmationStatus;
}

export const ACTIVITY_ACTIONS = [
  "event.created",
  "event.updated",
  "coordination.interest",
  "assignment.created",
  "inspection.arrived",
  "inspection.recorded",
  "handover.confirmed",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityLogEntry {
  id: string;
  actorUserId: string;
  action: ActivityAction;
  entityType: "event";
  entityId: string;
  timestamp: string;
  before: EventStatus | null;
  after: EventStatus | null;
}

export interface DemoDataset {
  version: number;
  organizations: Organization[];
  users: DemoUser[];
  events: HallEvent[];
  handovers: Handover[];
  activity: ActivityLogEntry[];
}
