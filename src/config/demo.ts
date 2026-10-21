import type { EventStatus } from "@/domain/types";

/**
 * Central demo configuration. Every operational value lives here — never inline numbers in components.
 *
 * ⚠️ PROVISIONAL values: the business values below come from the design/scenario documents
 * (docs/design/02-DESIGN-DELIVERY.md, Figma "07 — Open Questions" Q6, Q18–Q21) and are NOT final
 * product decisions. Change them here only.
 */
export const DEMO_CONFIG = {
  /** Bump when the seed shape changes so old browser data is discarded instead of crashing. */
  dataVersion: 2,
  storageKeys: {
    data: "hafez.demo.data.v1",
    session: "hafez.demo.session.v1",
  },
  /** Display timezone for all demo timestamps (Taif, Saudi Arabia). */
  timeZone: "Asia/Riyadh",

  /** Q6 (provisional): a hall may edit its event until a representative is assigned. */
  hallEditableStatuses: ["registered", "available", "awaiting_charity"] satisfies EventStatus[] as EventStatus[],

  /**
   * C2 "new event" form limits (provisional — chosen for the demo, not product decisions).
   * Times use fixed slots so the field matches the Figma dropdown and stays independent of browser locale.
   */
  newEvent: {
    /** Event date options: today … today + N days (Asia/Riyadh). */
    bookingWindowDays: 90,
    timeSlotMinutes: 30,
    titleLength: { min: 3, max: 80 },
    guests: { min: 1, max: 5000 },
    plannedQuantityKg: { min: 1, max: 5000 },
    notesMaxLength: 300,
    contactNameMaxLength: 60,
    /** Saudi mobile format used as an illustrative demo value: 05 followed by 8 digits. */
    phonePattern: /^05\d{8}$/,
    /** Fixed UTC offset of Asia/Riyadh (no DST) — used to build ISO timestamps from date + time slots. */
    utcOffset: "+03:00",
  },

  /**
   * C3 surplus forecast — a transparent rule, NOT an AI model (Figma 49:5891 / 49:6078).
   * ⚠️ Illustrative values from the demo scenario; must be calibrated with real data (blueprint open questions).
   */
  forecast: {
    /** Expected consumption per guest (kg). */
    kgPerGuest: 0.5,
    /** Safety margin added on top of expected consumption (0.2 = 20%). */
    safetyMargin: 0.2,
    /** Size of one full surplus box (kg) — used to express the surplus as boxes. */
    boxKg: 2,
    /** Bounds for "Adjust assumptions" on C3. */
    kgPerGuestRange: { min: 0.1, max: 2 },
    marginPercentRange: { min: 0, max: 50 },
  },

  /**
   * Beneficiary flow (Figma D6/H1/H2/H5) — ⚠️ provisional demo rules, listed as open decisions in the
   * design delivery ("الحد الأقصى 3 عبوات للطلب"، "قيم النقاط ومستويات الدرع 50 / 150").
   */
  beneficiary: {
    /** Default max units per request when publishing a listing. */
    perRequestLimit: 3,
    /** Default size of one unit (kg) when publishing a listing. */
    unitKg: 2,
    /** A listing shows "few left" when this many units or fewer remain. */
    lowStockUnits: 2,
  },
  /** Coordinating charity that receives beneficiary surplus reports in the demo city (Figma D7: Al Ataa). */
  reportsCharityId: "charity-ataa",
  points: {
    requestConfirmed: 10,
    reportRescued: 25,
    /** Shield levels by balance: bronze below silver. */
    silverAt: 50,
    goldAt: 150,
    /** "5 confirmed pickups" badge target. */
    pickupsBadgeTarget: 5,
  },

  /** Statuses considered finished for ordering lists (active events are shown first). */
  finishedStatuses: ["collected", "no_surplus", "not_collectable", "closed"] satisfies EventStatus[] as EventStatus[],
} as const;
