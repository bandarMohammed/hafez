import { z } from "zod";
import {
  ACTIVITY_ACTIONS,
  DECLINE_REASONS,
  EVENT_STATUSES,
  FOOD_CONDITIONS,
  FOOD_TYPES,
  INSPECTION_OUTCOMES,
  LISTING_CATEGORIES,
  NOTICE_KINDS,
  NOT_SUITABLE_REASONS,
  NO_SURPLUS_REASONS,
  PACKAGING_CONDITIONS,
  QUANTITY_UNITS,
  REPORT_STATUSES,
  REQUEST_REJECT_REASONS,
  REQUEST_STATUSES,
  ROLES,
  SAFETY_ITEMS,
} from "@/domain/types";
import type { DemoDataset } from "@/domain/types";

/** Runtime validation for data read back from browser storage (it may be stale, edited or corrupted). */
const localized = z.object({ ar: z.string(), en: z.string() });
const iso = z.iso.datetime({ offset: true });
const status = z.enum(EVENT_STATUSES);
const unit = z.enum(QUANTITY_UNITS);

export const datasetSchema = z.object({
  version: z.number().int(),
  organizations: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["platform", "hall", "charity", "observer"]),
      name: localized,
      city: localized,
      district: localized.nullable(),
    }),
  ),
  users: z.array(
    z.object({
      id: z.string().min(1),
      role: z.enum(ROLES),
      organizationId: z.string().nullable(),
      initials: localized,
      displayName: localized.optional(),
      pseudonym: z.string().optional(),
      availableUntil: z.string().optional(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string().min(1),
      hallId: z.string().min(1),
      title: localized,
      eventDate: iso,
      foodReadyAt: iso,
      expectedGuests: z.number().int().nonnegative(),
      expectedSurplusKg: z.number().nonnegative().nullable(),
      status,
      createdAt: iso,
      createdBy: z.string(),
      endsAt: iso.optional(),
      plannedQuantityKg: z.number().positive().optional(),
      foodTypes: z.array(z.enum(FOOD_TYPES)).optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      notes: z.string().nullable().optional(),
      forecast: z
        .object({
          kgPerGuest: z.number().positive(),
          safetyMargin: z.number().nonnegative(),
          consumptionKg: z.number().nonnegative(),
          recommendedKg: z.number().nonnegative(),
          plannedKgBefore: z.number().positive(),
          decision: z.enum(["use_recommended", "keep_planned"]),
          decidedAt: iso,
        })
        .optional(),
    }),
  ),
  coordination: z.array(
    z.object({
      id: z.string().min(1),
      eventId: z.string().min(1),
      charityId: z.string().min(1),
      coordinatorId: z.string().min(1),
      status: z.enum(["interested", "declined", "assigned"]),
      reason: z.enum(DECLINE_REASONS).nullable(),
      note: z.string().nullable(),
      createdAt: iso,
      decidedAt: iso.nullable(),
    }),
  ),
  assignments: z.array(
    z.object({
      id: z.string().min(1),
      eventId: z.string().min(1),
      charityId: z.string().min(1),
      representativeId: z.string().min(1),
      plannedArrivalAt: iso,
      assignedBy: z.string().min(1),
      assignedAt: iso,
      status: z.enum(["active", "completed"]),
    }),
  ),
  inspections: z.array(
    z.object({
      id: z.string().min(1),
      eventId: z.string().min(1),
      representativeId: z.string().min(1),
      arrivedAt: iso,
      inspectedAt: iso.nullable(),
      status: z.enum(["in_progress", "draft", "final"]),
      outcome: z.enum(INSPECTION_OUTCOMES).nullable(),
      estimatedQuantity: z.number().nonnegative().nullable(),
      unit: unit.nullable(),
      foodCondition: z.enum(FOOD_CONDITIONS).nullable(),
      packagingCondition: z.enum(PACKAGING_CONDITIONS).nullable(),
      safetyChecklist: z.array(z.enum(SAFETY_ITEMS)),
      reason: z.enum([...NO_SURPLUS_REASONS, ...NOT_SUITABLE_REASONS]).nullable(),
      notes: z.string().nullable(),
    }),
  ),
  handovers: z.array(
    z.object({
      id: z.string().min(1),
      eventId: z.string().min(1),
      inspectionId: z.string().nullable().optional(),
      actualQuantity: z.number().positive(),
      unit,
      handedOverAt: iso,
      receivingOrganizationId: z.string().min(1),
      confirmationStatus: z.enum(["pending", "confirmed_by_charity", "confirmed_by_hall", "confirmed_by_both"]),
      foodTypesText: z.string().nullable().optional(),
      handedBy: z.string().nullable().optional(),
      recordedBy: z.string().nullable().optional(),
      charityConfirmedAt: iso.nullable().optional(),
      hallConfirmedAt: iso.nullable().optional(),
      dispute: z.object({ note: z.string(), at: iso }).nullable().optional(),
    }),
  ),
  listings: z.array(
    z.object({
      id: z.string().min(1),
      charityId: z.string().min(1),
      sourceHandoverId: z.string().nullable(),
      title: localized,
      category: z.enum(LISTING_CATEGORIES),
      unitLabel: z.enum(["box", "bag"]),
      unitKg: z.number().positive(),
      totalUnits: z.number().int().positive(),
      perRequestLimit: z.number().int().positive(),
      area: localized,
      pickupStart: iso,
      pickupEnd: iso,
      publishedAt: iso,
      publishedBy: z.string().min(1),
      status: z.enum(["active", "archived"]),
    }),
  ),
  requests: z.array(
    z.object({
      id: z.string().min(1),
      listingId: z.string().min(1),
      beneficiaryId: z.string().min(1),
      units: z.number().int().positive(),
      status: z.enum(REQUEST_STATUSES),
      createdAt: iso,
      decidedAt: iso.nullable(),
      decidedBy: z.string().nullable(),
      rejectReason: z.enum(REQUEST_REJECT_REASONS).nullable(),
      confirmation: z
        .object({
          kind: z.enum(["full", "partial", "not_received"]),
          receivedUnits: z.number().int().nonnegative(),
          rating: z.enum(["excellent", "good", "needs_improvement"]).nullable(),
          note: z.string().nullable(),
          at: iso,
        })
        .nullable(),
    }),
  ),
  reports: z.array(
    z.object({
      id: z.string().min(1),
      reporterId: z.string().min(1),
      charityId: z.string().min(1),
      foodType: z.string().min(1),
      estimatedQuantity: z.number().positive(),
      unit: z.enum(["kg", "meal_portions", "boxes"]),
      readyAt: iso,
      area: localized,
      notes: z.string().nullable(),
      photoAttached: z.boolean(),
      status: z.enum(REPORT_STATUSES),
      createdAt: iso,
      infoRequest: z
        .object({ question: z.string(), at: iso, answer: z.string().nullable(), answeredAt: iso.nullable() })
        .nullable(),
      rejectReason: z.string().nullable(),
      inspection: z
        .object({
          representativeId: z.string().min(1),
          plannedAt: iso,
          assignedAt: iso,
          result: z
            .object({
              outcome: z.enum(["rescued", "not_suitable"]),
              actualKg: z.number().positive().nullable(),
              note: z.string().nullable(),
              at: iso,
            })
            .nullable(),
        })
        .nullable(),
      rescue: z.object({ actualKg: z.number().positive(), documentedAt: iso, documentedBy: z.string() }).nullable(),
    }),
  ),
  points: z.array(
    z.object({
      id: z.string().min(1),
      userId: z.string().min(1),
      points: z.number().int(),
      reason: z.enum(["request_confirmed", "report_rescued"]),
      sourceId: z.string().min(1),
      at: iso,
    }),
  ),
  pledges: z.array(z.object({ userId: z.string().min(1), tipId: z.string().min(1), at: iso })),
  notices: z.array(
    z.object({
      id: z.string().min(1),
      recipientUserId: z.string().min(1),
      kind: z.enum(NOTICE_KINDS),
      params: z.record(z.string(), z.union([z.string(), z.number()])),
      link: z.string().nullable(),
      createdAt: iso,
      readAt: iso.nullable(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string().min(1),
      actorUserId: z.string().min(1),
      action: z.enum(ACTIVITY_ACTIONS),
      entityType: z.enum(["event", "listing", "request", "report"]),
      entityId: z.string().min(1),
      timestamp: iso,
      before: z.string().nullable(),
      after: z.string().nullable(),
    }),
  ),
}) satisfies z.ZodType<DemoDataset>;
