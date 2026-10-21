import { z } from "zod";
import { ACTIVITY_ACTIONS, EVENT_STATUSES, FOOD_TYPES, ROLES } from "@/domain/types";
import type { DemoDataset } from "@/domain/types";

/** Runtime validation for data read back from browser storage (it may be stale, edited or corrupted). */
const localized = z.object({ ar: z.string(), en: z.string() });
const iso = z.iso.datetime({ offset: true });
const status = z.enum(EVENT_STATUSES);

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
    }),
  ),
  handovers: z.array(
    z.object({
      id: z.string().min(1),
      eventId: z.string().min(1),
      actualQuantity: z.number().positive(),
      unit: z.enum(["kg", "meal_portions", "boxes"]),
      handedOverAt: iso,
      receivingOrganizationId: z.string().min(1),
      confirmationStatus: z.enum(["pending", "confirmed_by_charity", "confirmed_by_hall", "confirmed_by_both"]),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string().min(1),
      actorUserId: z.string().min(1),
      action: z.enum(ACTIVITY_ACTIONS),
      entityType: z.literal("event"),
      entityId: z.string().min(1),
      timestamp: iso,
      before: status.nullable(),
      after: status.nullable(),
    }),
  ),
}) satisfies z.ZodType<DemoDataset>;
