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
  dataVersion: 1,
  storageKeys: {
    data: "hafez.demo.data.v1",
    session: "hafez.demo.session.v1",
  },
  /** Display timezone for all demo timestamps (Taif, Saudi Arabia). */
  timeZone: "Asia/Riyadh",

  /** Q6 (provisional): a hall may edit its event until a representative is assigned. */
  hallEditableStatuses: ["registered", "available", "awaiting_charity"] satisfies EventStatus[] as EventStatus[],

  /** Statuses considered finished for ordering lists (active events are shown first). */
  finishedStatuses: ["collected", "no_surplus", "not_collectable", "closed"] satisfies EventStatus[] as EventStatus[],
} as const;
