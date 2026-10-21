import { can } from "../permissions";
import { eventTimestamps } from "../newEvent";
import type { ValidNewEvent } from "../newEvent";
import type { HallEvent } from "../types";
import { fail, logActivity, notify, ok, replaceById, usersOf } from "./core";
import type { CommandContext, CommandResult } from "./core";

/**
 * Edit an event before pickup (blueprint §2: "تعديل مناسبات قاعته قبل الاستلام"; Q6: editable until a
 * representative is assigned). Status is unchanged; the change is logged. If a charity has already
 * expressed interest, its coordinator is told the details changed.
 */
export function updateEvent({ data, user, now }: CommandContext, eventId: string, input: ValidNewEvent): CommandResult {
  const event = data.events.find((e) => e.id === eventId);
  if (!event) return fail("not_found");
  if (!can(user, "event.edit", { kind: "event", event })) return fail("not_allowed");

  const updated: HallEvent = {
    ...event,
    title: { ar: input.title, en: input.title },
    ...eventTimestamps(input),
    expectedGuests: input.guests,
    plannedQuantityKg: input.plannedKg,
    foodTypes: input.foodTypes,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    notes: input.notes,
  };
  let next = { ...data, events: replaceById(data.events, updated) };
  next = logActivity(next, {
    actor: user,
    action: "event.updated",
    entityType: "event",
    entityId: eventId,
    at: now,
    before: event.status,
    after: event.status,
  });
  const interested = data.coordination.filter((c) => c.eventId === eventId && c.status === "interested");
  if (interested.length && event.foodReadyAt !== updated.foodReadyAt) {
    const fmt = (iso: string) => iso.slice(11, 16);
    next = notify(
      next,
      interested.map((c) => c.coordinatorId),
      "ready_time_updated",
      { event: eventId, from: fmt(event.foodReadyAt), to: fmt(updated.foodReadyAt) },
      `/charity/opportunities/${eventId}/assign`,
      now,
    );
  }
  return ok(next, { key: "eventUpdated", values: { event: eventId } });
}

/** Hall-side confirmation of a handover (blueprint matrix: "تأكيد طرف القاعة"). Optional; never replaces the charity's. */
export function confirmHandoverByHall({ data, user, now }: CommandContext, handoverId: string): CommandResult {
  const handover = data.handovers.find((h) => h.id === handoverId);
  const event = handover && data.events.find((e) => e.id === handover.eventId);
  if (!handover || !event) return fail("not_found");
  if (!can(user, "handover.confirm_hall", { kind: "handover", handover, event })) return fail("not_allowed");

  const confirmationStatus =
    handover.confirmationStatus === "confirmed_by_charity" || handover.confirmationStatus === "confirmed_by_both"
      ? "confirmed_by_both"
      : "confirmed_by_hall";
  let next = {
    ...data,
    handovers: replaceById(data.handovers, { ...handover, confirmationStatus, hallConfirmedAt: now.toISOString() }),
  };
  next = logActivity(next, {
    actor: user,
    action: "handover.hall_confirmed",
    entityType: "event",
    entityId: event.id,
    at: now,
    before: event.status,
    after: event.status,
  });
  next = notify(
    next,
    usersOf(data, "charity_coordinator", handover.receivingOrganizationId).map((u) => u.id),
    "handover_confirmed",
    { event: event.id, qty: handover.actualQuantity },
    `/charity/handovers/${handover.id}`,
    now,
  );
  return ok(next, { key: "hallConfirmed", values: { event: event.id } });
}
