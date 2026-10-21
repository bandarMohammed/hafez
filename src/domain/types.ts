/**
 * Domain types — mirror the data model in docs/Hafez_Product_Blueprint_Updated.html §7 (v1.1) and the
 * beneficiary entities shown in the Figma screens D6, D7 and H1–H8.
 * Relations use ids only (blueprint §7: never copy a whole organisation into a record).
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
  /** Display name for team members (e.g. "الممثل 01 — فريق العطاء"). Demo accounts fall back to the role name. */
  displayName?: LocalizedText;
  /** Beneficiaries are only ever shown by pseudonym (Figma D6/D7: "رمز مستعار #17"). */
  pseudonym?: string;
  /** Field representatives: last time they are available today ("HH:MM"), shown in D4. */
  availableUntil?: string;
}

/** Food categories a hall can declare for an event (C2). Labels live in src/messages (newEvent.foodTypes). */
export const FOOD_TYPES = ["hot_meals", "rice_dishes", "salads", "desserts", "bakery", "fruit"] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

/** C3 decision stored with the event: the assumptions used and what the hall chose. */
export interface EventForecast {
  kgPerGuest: number;
  /** 0.2 = 20% */
  safetyMargin: number;
  consumptionKg: number;
  recommendedKg: number;
  /** Planned quantity entered in C2, before the decision. */
  plannedKgBefore: number;
  decision: "use_recommended" | "keep_planned";
  decidedAt: string;
}

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
  /** Set when the hall decides on the C3 forecast (before the event is made available). */
  forecast?: EventForecast;
}

/* ------------------------------------------------------------------ coordination (UC-02, UC-03) */

/** Figma D3 decline reasons (the reason is optional). */
export const DECLINE_REASONS = ["out_of_coverage", "too_far", "no_team", "ready_time_unsuitable", "other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface CoordinationRequest {
  id: string;
  eventId: string;
  charityId: string;
  coordinatorId: string;
  status: "interested" | "declined" | "assigned";
  reason: DeclineReason | null;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Assignment {
  id: string;
  eventId: string;
  charityId: string;
  representativeId: string;
  /** Independent of the event time and the food-ready time (Figma D4). */
  plannedArrivalAt: string;
  assignedBy: string;
  assignedAt: string;
  status: "active" | "completed";
}

/* ------------------------------------------------------------------ inspection & handover (UC-04, UC-05, UC-08) */

export const INSPECTION_OUTCOMES = ["surplus_available", "no_surplus", "not_safe_to_collect"] as const;
export type InspectionOutcome = (typeof INSPECTION_OUTCOMES)[number];

export const FOOD_CONDITIONS = ["good", "acceptable", "poor"] as const;
export type FoodCondition = (typeof FOOD_CONDITIONS)[number];

export const PACKAGING_CONDITIONS = ["sealed_clean", "covered", "open_or_damaged"] as const;
export type PackagingCondition = (typeof PACKAGING_CONDITIONS)[number];

/** Figma E3 illustrative safety checklist — needs approval by a competent authority before real use. */
export const SAFETY_ITEMS = ["temperature", "sealed", "within_two_hours", "no_contamination"] as const;
export type SafetyItem = (typeof SAFETY_ITEMS)[number];

export const NO_SURPLUS_REASONS = ["finished_during_event", "taken_by_hall", "other"] as const;
export const NOT_SUITABLE_REASONS = [
  "storage_temperature",
  "time_exceeded",
  "contamination",
  "packaging",
  "other",
] as const;
export type OutcomeReason = (typeof NO_SURPLUS_REASONS)[number] | (typeof NOT_SUITABLE_REASONS)[number];

export type QuantityUnit = "kg" | "meal_portions" | "boxes";
export const QUANTITY_UNITS = ["kg", "meal_portions", "boxes"] as const satisfies readonly QuantityUnit[];

export interface Inspection {
  id: string;
  eventId: string;
  representativeId: string;
  arrivedAt: string;
  /** null while the representative is on site and has not saved a final result. */
  inspectedAt: string | null;
  status: "in_progress" | "draft" | "final";
  outcome: InspectionOutcome | null;
  estimatedQuantity: number | null;
  unit: QuantityUnit | null;
  foodCondition: FoodCondition | null;
  packagingCondition: PackagingCondition | null;
  safetyChecklist: SafetyItem[];
  reason: OutcomeReason | null;
  notes: string | null;
}

export type ConfirmationStatus = "pending" | "confirmed_by_charity" | "confirmed_by_hall" | "confirmed_by_both";

export interface Handover {
  id: string;
  eventId: string;
  inspectionId?: string | null;
  /** Actual weighed quantity — separate from every estimate (blueprint §6). */
  actualQuantity: number;
  unit: QuantityUnit;
  handedOverAt: string;
  receivingOrganizationId: string;
  confirmationStatus: ConfirmationStatus;
  /** Free text as typed by the representative (e.g. "أرز ولحم، خبز"). */
  foodTypesText?: string | null;
  /** Who handed it over on the hall side (name as typed). */
  handedBy?: string | null;
  /** Representative who recorded the provisional handover. */
  recordedBy?: string | null;
  charityConfirmedAt?: string | null;
  hallConfirmedAt?: string | null;
  /** Coordinator flagged a quantity difference instead of confirming (Figma D5). */
  dispute?: { note: string; at: string } | null;
}

/* ------------------------------------------------------------------ beneficiary (blueprint §2.1, Figma D6/D7/H1–H8) */

export const LISTING_CATEGORIES = ["meals", "bakery", "desserts", "other"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

/** Food listing published by a charity — only from a documented handover (Figma D6). */
export interface FoodListing {
  id: string;
  charityId: string;
  sourceHandoverId: string | null;
  title: LocalizedText;
  category: ListingCategory;
  unitLabel: "box" | "bag";
  unitKg: number;
  totalUnits: number;
  perRequestLimit: number;
  /** General area only — never an exact address (blueprint §2.1). */
  area: LocalizedText;
  pickupStart: string;
  pickupEnd: string;
  publishedAt: string;
  publishedBy: string;
  status: "active" | "archived";
}

export const REQUEST_STATUSES = [
  "pending",
  "accepted",
  "ready",
  "completed",
  "partial",
  "not_received",
  "rejected",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_REJECT_REASONS = ["over_limit", "sold_out", "outside_window", "other"] as const;
export type RequestRejectReason = (typeof REQUEST_REJECT_REASONS)[number];

export interface FoodRequest {
  id: string;
  listingId: string;
  beneficiaryId: string;
  units: number;
  status: RequestStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  rejectReason: RequestRejectReason | null;
  confirmation: {
    kind: "full" | "partial" | "not_received";
    receivedUnits: number;
    rating: "excellent" | "good" | "needs_improvement" | null;
    note: string | null;
    at: string;
  } | null;
}

export const REPORT_STATUSES = ["pending", "needs_info", "accepted", "rejected", "coordinated"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Beneficiary surplus report (Figma H4/H8/D7). Never published as available food automatically. */
export interface SurplusReport {
  id: string;
  reporterId: string;
  charityId: string;
  foodType: string;
  estimatedQuantity: number;
  unit: "kg" | "meal_portions" | "boxes";
  readyAt: string;
  area: LocalizedText;
  notes: string | null;
  /** The demo never stores images — only whether one was chosen (privacy). */
  photoAttached: boolean;
  status: ReportStatus;
  createdAt: string;
  infoRequest: { question: string; at: string; answer: string | null; answeredAt: string | null } | null;
  rejectReason: string | null;
  inspection: {
    representativeId: string;
    plannedAt: string;
    assignedAt: string;
    result: {
      outcome: "rescued" | "not_suitable";
      actualKg: number | null;
      note: string | null;
      at: string;
    } | null;
  } | null;
  rescue: { actualKg: number; documentedAt: string; documentedBy: string } | null;
}

/** Points ledger (Figma H5). One entry per verified source event — never awarded twice. */
export interface PointsEntry {
  id: string;
  userId: string;
  points: number;
  reason: "request_confirmed" | "report_rescued";
  sourceId: string;
  at: string;
}

export interface TipPledge {
  userId: string;
  tipId: string;
  at: string;
}

/* ------------------------------------------------------------------ notices & activity */

export const NOTICE_KINDS = [
  "task_assigned",
  "ready_time_updated",
  "handover_recorded",
  "handover_confirmed",
  "handover_disputed",
  "coordination_interest",
  "coordination_declined",
  "rep_cannot_attend",
  "inspection_result",
  "request_received",
  "request_accepted",
  "request_rejected",
  "request_confirmed",
  "report_received",
  "report_info_requested",
  "report_info_added",
  "report_accepted",
  "report_rejected",
  "report_inspection_assigned",
  "report_result",
  "report_rescued",
  "listing_published",
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** In-app notice only — no SMS / WhatsApp in the MVP (Figma E6). */
export interface Notice {
  id: string;
  recipientUserId: string;
  kind: NoticeKind;
  /** Values interpolated into the localized message (ids, numbers, times). */
  params: Record<string, string | number>;
  /** Locale-free path to open, e.g. "/field/tasks/E-105". */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export const ACTIVITY_ACTIONS = [
  "event.created",
  "event.updated",
  "coordination.interest",
  "coordination.declined",
  "assignment.created",
  "inspection.arrived",
  "inspection.recorded",
  "handover.recorded",
  "handover.confirmed",
  "handover.hall_confirmed",
  "handover.disputed",
  "field.cannot_attend",
  "listing.published",
  "request.created",
  "request.accepted",
  "request.rejected",
  "request.confirmed",
  "report.created",
  "report.info_requested",
  "report.info_added",
  "report.accepted",
  "report.rejected",
  "report.result_recorded",
  "report.rescued",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type EntityType = "event" | "listing" | "request" | "report";

export interface ActivityLogEntry {
  id: string;
  actorUserId: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  timestamp: string;
  /** Status before/after (event, request or report status key). */
  before: string | null;
  after: string | null;
}

export interface DemoDataset {
  version: number;
  organizations: Organization[];
  users: DemoUser[];
  events: HallEvent[];
  coordination: CoordinationRequest[];
  assignments: Assignment[];
  inspections: Inspection[];
  handovers: Handover[];
  listings: FoodListing[];
  requests: FoodRequest[];
  reports: SurplusReport[];
  points: PointsEntry[];
  pledges: TipPledge[];
  notices: Notice[];
  activity: ActivityLogEntry[];
}
