import { DEMO_CONFIG } from "@/config/demo";
import { DEFAULT_ASSUMPTIONS, applyForecastDecision } from "@/domain/forecast";
import { addDays, buildNewEvent, riyadhDate } from "@/domain/newEvent";
import type { ValidNewEvent } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import { ACTIVE_REQUEST } from "@/domain/selectors/beneficiary";
import { SAFETY_ITEMS } from "@/domain/types";
import type { Assignment, DemoDataset, DemoUser, FoodListing, FoodRequest, Handover, HallEvent } from "@/domain/types";
import { confirmRequest, createRequest, pledgeTip } from "@/domain/workflow/beneficiary";
import {
  assignRepresentative,
  confirmHandoverByCharity,
  decideRequest,
  expressInterest,
  publishListing,
} from "@/domain/workflow/charity";
import { fail, ok } from "@/domain/workflow/core";
import type { CommandContext, CommandResult } from "@/domain/workflow/core";
import { checkIn, recordHandover, saveInspection } from "@/domain/workflow/field";

/**
 * "Hafez journey" — one guided scenario that walks a single record through every role, for a 5-minute pitch.
 * Nothing here is new business logic: each step calls the existing workflow commands as the real demo account
 * of that role, so every `can()` rule, activity entry, notice and derived number is the same as in the full screens.
 * Numbers follow the Figma B5 scenario: 300 guests, 210 kg planned → 180 kg recommended → 30 kg expected surplus,
 * 20 kg actually handed over (10 boxes × 2 kg), 2 boxes requested and confirmed by the beneficiary.
 */
export const JOURNEY = {
  /** The journey event is found by this title (user-entered text is not translated). */
  title: "حفل زفاف — رحلة حفيظ",
  listingTitle: "أرز ولحم — عبوات حفل الزفاف",
  hall: "demo-hall-01",
  charity: "demo-charity-01",
  rep: "demo-field-01",
  beneficiary: "demo-beneficiary-01",
  guests: 300,
  plannedKg: 210,
  inspectedKg: 30,
  handoverKg: 20,
  unitKg: 2,
  totalUnits: 10,
  requestUnits: 2,
} as const;

export const JOURNEY_STEPS = ["hall", "charity", "field", "publish", "beneficiary", "behavior"] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

/** Who plays the scenario: the account allowed to control the demo data (platform manager), never the judges. */
export const canRunJourney = (user: DemoUser | null | undefined) => can(user, "demo.reset");

export interface JourneyState {
  event?: HallEvent;
  assignment?: Assignment;
  handover?: Handover;
  listing?: FoodListing;
  request?: FoodRequest;
  pledged: boolean;
  done: Record<JourneyStep, boolean>;
  /** First step not done yet, or null when the whole journey is complete. */
  next: JourneyStep | null;
}

/** Everything about the journey is derived from the shared records — nothing is stored separately. */
export function selectJourney(data: DemoDataset, tipId: string): JourneyState {
  const event = [...data.events].reverse().find((e) => e.title.ar === JOURNEY.title);
  const assignment = event && data.assignments.find((a) => a.eventId === event.id);
  const handover = event && data.handovers.find((h) => h.eventId === event.id);
  const listing = handover && data.listings.find((l) => l.sourceHandoverId === handover.id);
  const request =
    listing &&
    [...data.requests].reverse().find((r) => r.listingId === listing.id && r.beneficiaryId === JOURNEY.beneficiary);
  const pledged = data.pledges.some((p) => p.userId === JOURNEY.beneficiary && p.tipId === tipId);
  const done: Record<JourneyStep, boolean> = {
    hall: Boolean(event && event.status !== "registered"),
    charity: Boolean(assignment),
    field: Boolean(handover),
    publish: Boolean(listing),
    beneficiary: request?.status === "completed",
    behavior: pledged,
  };
  return {
    event,
    assignment,
    handover,
    listing,
    request,
    pledged,
    done,
    next: JOURNEY_STEPS.find((s) => !done[s]) ?? null,
  };
}

const OFFSET = DEMO_CONFIG.newEvent.utcOffset;

function account(data: DemoDataset, id: string): DemoUser | undefined {
  return data.users.find((u) => u.id === id);
}

/** Runs the commands of one step in order; stops at the first failure so nothing is saved half-way. */
function runStep(data: DemoDataset, step: JourneyStep, now: Date, tipId: string): CommandResult<unknown> {
  const s = selectJourney(data, tipId);
  const as = (id: string): CommandContext | null => {
    const user = account(data, id);
    return user ? { data, user, now } : null;
  };

  switch (step) {
    case "hall": {
      // C2 + C3 — the hall registers the event, then publishes it with the recommended quantity.
      const hall = account(data, JOURNEY.hall);
      if (!hall || !can(hall, "event.create")) return fail("not_allowed");
      const input: ValidNewEvent = {
        title: JOURNEY.title,
        date: addDays(riyadhDate(now), 1),
        endTime: "23:00",
        readyTime: "23:30",
        guests: JOURNEY.guests,
        foodTypes: ["hot_meals", "rice_dishes"],
        plannedKg: JOURNEY.plannedKg,
        contactName: hall.displayName?.ar ?? "مسؤول القاعة",
        contactPhone: "0500000000",
        notes: null,
      };
      const { event, activity } = buildNewEvent(data, input, hall, now);
      const created: DemoDataset = { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
      const published = applyForecastDecision(created, event.id, hall, "use_recommended", DEFAULT_ASSUMPTIONS, now);
      return published ? ok(published.data) : fail("not_allowed");
    }

    case "charity": {
      // D2 + D4 — the charity takes the opportunity and assigns representative 01 at the ready time.
      const ctx = as(JOURNEY.charity);
      if (!ctx || !s.event) return fail("invalid_state");
      const interest = expressInterest(ctx, s.event.id);
      if (!interest.ok) return interest;
      return assignRepresentative({ ...ctx, data: interest.data }, s.event.id, {
        representativeId: JOURNEY.rep,
        plannedArrivalAt: s.event.foodReadyAt,
      });
    }

    case "field": {
      // E2 → E3 → E4 — check-in, documented inspection, provisional handover with the actual weight.
      const ctx = as(JOURNEY.rep);
      if (!ctx || !s.event) return fail("invalid_state");
      const arrived = checkIn(ctx, s.event.id);
      if (!arrived.ok) return arrived;
      const inspected = saveInspection(
        { ...ctx, data: arrived.data },
        s.event.id,
        {
          outcome: "surplus_available",
          estimatedQuantity: JOURNEY.inspectedKg,
          unit: "kg",
          foodCondition: "good",
          packagingCondition: "sealed_clean",
          safetyChecklist: [...SAFETY_ITEMS],
          reason: null,
          notes: null,
        },
        "final",
      );
      if (!inspected.ok) return inspected;
      return recordHandover({ ...ctx, data: inspected.data }, s.event.id, {
        actualQuantity: JOURNEY.handoverKg,
        unit: "kg",
        foodTypesText: "أرز ولحم",
        handedOverAt: now.toISOString(),
        handedBy: "مسؤول القاعة (تجريبي)",
      });
    }

    case "publish": {
      // D5 + D6 — the charity confirms receipt ("Collected") and packages it into a listing for beneficiaries.
      const ctx = as(JOURNEY.charity);
      if (!ctx || !s.event || !s.handover) return fail("invalid_state");
      const confirmed = confirmHandoverByCharity(ctx, s.handover.id);
      if (!confirmed.ok) return confirmed;
      const hall = data.organizations.find((o) => o.id === s.event!.hallId);
      const pickupDay = addDays(riyadhDate(now), 2);
      return publishListing(
        { ...ctx, data: confirmed.data },
        {
          sourceHandoverId: s.handover.id,
          title: JOURNEY.listingTitle,
          category: "meals",
          unitLabel: "box",
          unitKg: JOURNEY.unitKg,
          totalUnits: JOURNEY.totalUnits,
          perRequestLimit: DEMO_CONFIG.beneficiary.perRequestLimit,
          area: hall?.district ?? hall?.city ?? { ar: "", en: "" },
          pickupStart: `${pickupDay}T13:00:00${OFFSET}`,
          pickupEnd: `${pickupDay}T16:00:00${OFFSET}`,
        },
      );
    }

    case "beneficiary": {
      // H2 → D6 → H7 — request within the limit, charity accepts, beneficiary confirms the full pickup.
      const ben = as(JOURNEY.beneficiary);
      const charity = account(data, JOURNEY.charity);
      if (!ben || !charity || !s.listing) return fail("invalid_state");
      let current = data;
      let requestId = s.request && ACTIVE_REQUEST.includes(s.request.status) ? s.request.id : null;
      if (!requestId) {
        const sent = createRequest(ben, s.listing.id, JOURNEY.requestUnits);
        if (!sent.ok) return sent;
        current = sent.data;
        requestId = sent.value;
      }
      const pending = current.requests.find((r) => r.id === requestId);
      if (pending?.status === "pending") {
        const accepted = decideRequest({ data: current, user: charity, now }, requestId, { accept: true });
        if (!accepted.ok) return accepted;
        current = accepted.data;
      }
      return confirmRequest({ ...ben, data: current }, requestId, {
        kind: "full",
        receivedUnits: null,
        rating: "excellent",
        note: null,
      });
    }

    case "behavior": {
      // H6 — the weekly pledge (earns nothing; points only come from verified events).
      const ben = as(JOURNEY.beneficiary);
      return ben ? pledgeTip(ben, tipId) : fail("not_found");
    }
  }
}

/**
 * Store command: plays `steps` in order as one change — saved only if every step succeeds.
 * The current account must be the platform manager (judges are read-only).
 */
export function playJourney(steps: JourneyStep[], tipId: string) {
  return ({ data, user, now }: CommandContext): CommandResult => {
    if (!canRunJourney(user)) return fail("not_allowed");
    let current = data;
    for (const step of steps) {
      if (selectJourney(current, tipId).next !== step) return fail("invalid_state");
      const r = runStep(current, step, now, tipId);
      if (!r.ok) return r;
      current = r.data;
    }
    return ok(current);
  };
}

/** Steps left from the current position (for "play the whole journey"). */
export function remainingSteps(state: JourneyState): JourneyStep[] {
  return state.next ? JOURNEY_STEPS.slice(JOURNEY_STEPS.indexOf(state.next)) : [];
}
