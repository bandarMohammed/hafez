import { DEMO_CONFIG } from "@/config/demo";
import { can } from "./permissions";
import type { ActivityLogEntry, DemoDataset, DemoUser, EventForecast, HallEvent } from "./types";

/**
 * Figma C3 — surplus forecast & recommendation before publishing.
 * A simple, transparent rule (not a trained model):
 *   1) consumption  = guests × kg/guest
 *   2) recommended  = consumption × (1 + margin), rounded up to a whole kg, never above the planned quantity
 *   3) reduction    = planned − recommended
 *   4) surplus      = recommended − consumption  (= full boxes × box size)
 *   baseline        = planned − consumption  (without the recommendation, for comparison)
 */

export interface ForecastAssumptions {
  kgPerGuest: number;
  /** 0.2 = 20% */
  safetyMargin: number;
}

export interface ForecastResult {
  guests: number;
  plannedKg: number;
  consumptionKg: number;
  recommendedKg: number;
  reductionKg: number;
  surplusAfterKg: number;
  fullBoxes: number;
  baselineSurplusKg: number;
}

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  kgPerGuest: DEMO_CONFIG.forecast.kgPerGuest,
  safetyMargin: DEMO_CONFIG.forecast.safetyMargin,
};

/** Removes binary floating-point noise (150 × 1.2 = 180.00000000000003 → 180) before rounding. */
const clean = (n: number) => Number(n.toFixed(6));
const oneDecimal = (n: number) => Math.round(clean(n) * 10) / 10;

export function computeForecast(
  input: { guests: number; plannedKg: number },
  a: ForecastAssumptions = DEFAULT_ASSUMPTIONS,
): ForecastResult {
  const consumptionKg = oneDecimal(input.guests * a.kgPerGuest);
  const withMargin = Math.ceil(clean(consumptionKg * (1 + a.safetyMargin)));
  const recommendedKg = Math.min(input.plannedKg, withMargin);
  const surplusAfterKg = Math.max(0, oneDecimal(recommendedKg - consumptionKg));
  return {
    guests: input.guests,
    plannedKg: input.plannedKg,
    consumptionKg,
    recommendedKg,
    reductionKg: input.plannedKg - recommendedKg,
    surplusAfterKg,
    fullBoxes: Math.floor(clean(surplusAfterKg / DEMO_CONFIG.forecast.boxKg)),
    baselineSurplusKg: Math.max(0, oneDecimal(input.plannedKg - consumptionKg)),
  };
}

export type ForecastAvailability = "ok" | "notFound" | "notAllowed" | "alreadyDecided" | "noPlannedQuantity";

/** Whether C3 can be shown for this event and account. Forecasting happens before publishing only. */
export function forecastAvailability(user: DemoUser | null, event: HallEvent | undefined): ForecastAvailability {
  if (!user || !event || !can(user, "event.view", { kind: "event", event })) return "notFound";
  if (!can(user, "event.edit", { kind: "event", event })) return "notAllowed";
  if (event.status !== "registered" || event.forecast) return "alreadyDecided";
  if (!event.plannedQuantityKg) return "noPlannedQuantity";
  return "ok";
}

export type ForecastDecision = EventForecast["decision"];

/** Applies the hall's C3 decision: publish the event ("available") with the chosen quantity and estimate. */
export function applyForecastDecision(
  data: DemoDataset,
  eventId: string,
  user: DemoUser,
  decision: ForecastDecision,
  assumptions: ForecastAssumptions,
  now: Date,
): { data: DemoDataset; event: HallEvent } | null {
  const event = data.events.find((e) => e.id === eventId);
  if (forecastAvailability(user, event) !== "ok" || !event?.plannedQuantityKg) return null;

  const r = computeForecast({ guests: event.expectedGuests, plannedKg: event.plannedQuantityKg }, assumptions);
  const useRecommended = decision === "use_recommended";
  const decidedAt = now.toISOString();
  const updated: HallEvent = {
    ...event,
    status: "available",
    plannedQuantityKg: useRecommended ? r.recommendedKg : r.plannedKg,
    // Still an estimate — the actual result is recorded by the inspection (never shown as received).
    expectedSurplusKg: useRecommended ? r.surplusAfterKg : r.baselineSurplusKg,
    forecast: {
      kgPerGuest: assumptions.kgPerGuest,
      safetyMargin: assumptions.safetyMargin,
      consumptionKg: r.consumptionKg,
      recommendedKg: r.recommendedKg,
      plannedKgBefore: r.plannedKg,
      decision,
      decidedAt,
    },
  };
  const activity: ActivityLogEntry = {
    id: `A-${String(data.activity.length + 1).padStart(2, "0")}-${event.id}`,
    actorUserId: user.id,
    action: "event.updated",
    entityType: "event",
    entityId: event.id,
    timestamp: decidedAt,
    before: event.status,
    after: "available",
  };
  return {
    event: updated,
    data: {
      ...data,
      events: data.events.map((e) => (e.id === event.id ? updated : e)),
      activity: [...data.activity, activity],
    },
  };
}
