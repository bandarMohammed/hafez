import { DEMO_CONFIG } from "@/config/demo";
import type { ActivityLogEntry, DemoDataset, DemoUser, FoodType, HallEvent } from "./types";

/**
 * Figma C2 — "Register a new event". Pure functions (no React, no storage) so the rules are unit-tested:
 * validation, id generation, timestamp building and the record + activity entry that saving produces.
 */

/** Raw form values exactly as typed/selected (strings until validated). */
export interface NewEventValues {
  title: string;
  /** YYYY-MM-DD (Asia/Riyadh calendar day). */
  date: string;
  /** HH:MM slot. */
  endTime: string;
  /** HH:MM slot — independent of the end time (blueprint). */
  readyTime: string;
  guests: string;
  foodTypes: FoodType[];
  plannedKg: string;
  contactName: string;
  contactPhone: string;
  notes: string;
}

/** Field order = visual/DOM order of the form (used for the error summary and focus). */
export const NEW_EVENT_FIELDS = [
  "title",
  "date",
  "guests",
  "endTime",
  "readyTime",
  "foodTypes",
  "plannedKg",
  "contactName",
  "contactPhone",
  "notes",
] as const satisfies readonly (keyof NewEventValues)[];
export type NewEventField = (typeof NEW_EVENT_FIELDS)[number];

export type NewEventError =
  "required" | "titleLength" | "dateRange" | "wholeNumber" | "guestsRange" | "quantityRange" | "phone" | "tooLong";

export type NewEventErrors = Partial<Record<NewEventField, NewEventError>>;

/** Submit buttons in Figma C2: "Save & make available" vs "Save as registered". */
export type SaveMode = "available" | "registered";

export interface ValidNewEvent {
  title: string;
  date: string;
  endTime: string;
  readyTime: string;
  guests: number;
  foodTypes: FoodType[];
  plannedKg: number;
  contactName: string;
  contactPhone: string;
  notes: string | null;
}

const cfg = DEMO_CONFIG.newEvent;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → Latin, so "٣٠٠" is accepted like "300". */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function parseWholeNumber(raw: string): number | "invalid" | "empty" {
  const v = normalizeDigits(raw).replace(/[\s,٬]/g, "");
  if (v === "") return "empty";
  return /^\d+$/.test(v) ? Number(v) : "invalid";
}

/** Calendar date (YYYY-MM-DD) in Asia/Riyadh for a given instant. */
export function riyadhDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEMO_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Date options for the event-date dropdown: today … today + bookingWindowDays. */
export function eventDateOptions(now: Date): string[] {
  const today = riyadhDate(now);
  return Array.from({ length: cfg.bookingWindowDays + 1 }, (_, i) => addDays(today, i));
}

/** HH:MM slots for the time dropdowns. */
export function timeSlots(): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += cfg.timeSlotMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export function validateNewEvent(
  values: NewEventValues,
  now: Date,
): { ok: true; data: ValidNewEvent } | { ok: false; errors: NewEventErrors } {
  const errors: NewEventErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = "required";
  else if (title.length < cfg.titleLength.min || title.length > cfg.titleLength.max) errors.title = "titleLength";

  if (!values.date) errors.date = "required";
  else if (!eventDateOptions(now).includes(values.date)) errors.date = "dateRange";

  const guests = parseWholeNumber(values.guests);
  if (guests === "empty") errors.guests = "required";
  else if (guests === "invalid") errors.guests = "wholeNumber";
  else if (guests < cfg.guests.min || guests > cfg.guests.max) errors.guests = "guestsRange";

  const slots = timeSlots();
  if (!slots.includes(values.endTime)) errors.endTime = "required";
  if (!slots.includes(values.readyTime)) errors.readyTime = "required";

  if (values.foodTypes.length === 0) errors.foodTypes = "required";

  const planned = parseWholeNumber(values.plannedKg);
  if (planned === "empty") errors.plannedKg = "required";
  else if (planned === "invalid") errors.plannedKg = "wholeNumber";
  else if (planned < cfg.plannedQuantityKg.min || planned > cfg.plannedQuantityKg.max)
    errors.plannedKg = "quantityRange";

  const contactName = values.contactName.trim();
  if (!contactName) errors.contactName = "required";
  else if (contactName.length > cfg.contactNameMaxLength) errors.contactName = "tooLong";

  const phone = normalizeDigits(values.contactPhone).replace(/[\s-]/g, "");
  if (!phone) errors.contactPhone = "required";
  else if (!cfg.phonePattern.test(phone)) errors.contactPhone = "phone";

  const notes = values.notes.trim();
  if (notes.length > cfg.notesMaxLength) errors.notes = "tooLong";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      date: values.date,
      endTime: values.endTime,
      readyTime: values.readyTime,
      guests: guests as number,
      foodTypes: [...values.foodTypes],
      plannedKg: planned as number,
      contactName,
      contactPhone: phone,
      notes: notes || null,
    },
  };
}

/** Next sequential event id: E-101 … E-108 in the seed → E-109 (matches the Figma scenario). */
export function nextEventId(data: DemoDataset): string {
  const max = data.events.reduce((m, e) => {
    const n = /^E-(\d+)$/.exec(e.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 100);
  return `E-${max + 1}`;
}

const iso = (date: string, time: string) => `${date}T${time}:00${cfg.utcOffset}`;

/**
 * Timestamps from the form. Both times are on the event date; a ready time earlier than the end time
 * is read as after midnight (next day) — e.g. ends 23:00, food ready 00:30. (Provisional rule.)
 */
export function eventTimestamps(v: Pick<ValidNewEvent, "date" | "endTime" | "readyTime">) {
  const readyDate = v.readyTime < v.endTime ? addDays(v.date, 1) : v.date;
  return {
    /** Form has no start time (Figma), so the event date is stored as the calendar day. */
    eventDate: iso(v.date, "00:00"),
    endsAt: iso(v.date, v.endTime),
    foodReadyAt: iso(readyDate, v.readyTime),
  };
}

/** Builds the stored record and its activity entry. Status follows the chosen save button. */
export function buildNewEvent(
  data: DemoDataset,
  input: ValidNewEvent,
  user: DemoUser,
  mode: SaveMode,
  now: Date,
): { event: HallEvent; activity: ActivityLogEntry } {
  if (!user.organizationId) throw new Error("Only a hall account can register a hall event");
  const id = nextEventId(data);
  const createdAt = now.toISOString();
  const status = mode === "available" ? "available" : "registered";
  const event: HallEvent = {
    id,
    hallId: user.organizationId,
    // User-entered text is not translated: the same title is shown in both languages.
    title: { ar: input.title, en: input.title },
    ...eventTimestamps(input),
    expectedGuests: input.guests,
    // The surplus estimate comes from the C3 forecast (not built yet) — never guessed here.
    expectedSurplusKg: null,
    status,
    createdAt,
    createdBy: user.id,
    plannedQuantityKg: input.plannedKg,
    foodTypes: input.foodTypes,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    notes: input.notes,
  };
  const activity: ActivityLogEntry = {
    id: `A-${String(data.activity.length + 1).padStart(2, "0")}-${id}`,
    actorUserId: user.id,
    action: "event.created",
    entityType: "event",
    entityId: id,
    timestamp: createdAt,
    before: null,
    after: status,
  };
  return { event, activity };
}

export function emptyNewEventValues(contactName: string): NewEventValues {
  return {
    title: "",
    date: "",
    endTime: "",
    readyTime: "",
    guests: "",
    foodTypes: [],
    plannedKg: "",
    contactName,
    contactPhone: "",
    notes: "",
  };
}
