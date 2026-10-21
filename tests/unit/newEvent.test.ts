import { afterEach, describe, expect, it } from "vitest";
import { createLocalRepository, createMemoryStorage } from "@/data/repository";
import { datasetSchema } from "@/data/schema";
import { createSeed } from "@/data/seed";
import { __setRepositoryForTests, useDemoStore } from "@/data/store";
import { selectHallActivity, selectHallEvents, selectHallMetrics } from "@/domain/hall";
import {
  buildNewEvent,
  emptyNewEventValues,
  eventDateOptions,
  eventTimestamps,
  nextEventId,
  normalizeDigits,
  riyadhDate,
  timeSlots,
  validateNewEvent,
} from "@/domain/newEvent";
import type { NewEventValues, ValidNewEvent } from "@/domain/newEvent";

// 2026-10-21 09:00 in Riyadh.
const NOW = new Date("2026-10-21T06:00:00Z");

/** The Figma C2 scenario: 300 guests, 210 kg planned, ends 23:00, food ready 23:30, 30 Oct 2026. */
const scenario = (over: Partial<NewEventValues> = {}): NewEventValues => ({
  ...emptyNewEventValues("مسؤول القاعة (تجريبي)"),
  title: "حفل زفاف (سيناريو العرض)",
  date: "2026-10-30",
  endTime: "23:00",
  readyTime: "23:30",
  guests: "300",
  foodTypes: ["hot_meals", "desserts"],
  plannedKg: "210",
  contactPhone: "0500000000",
  ...over,
});

const valid = (over: Partial<NewEventValues> = {}): ValidNewEvent => {
  const r = validateNewEvent(scenario(over), NOW);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.data;
};

describe("C2 validation", () => {
  it("accepts the Figma scenario", () => {
    expect(validateNewEvent(scenario(), NOW).ok).toBe(true);
  });

  it("an empty form flags every required field (contact person is prefilled, notes optional)", () => {
    const r = validateNewEvent(emptyNewEventValues("Hall manager (demo)"), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual(
        ["contactPhone", "date", "endTime", "foodTypes", "guests", "plannedKg", "readyTime", "title"].sort(),
      );
  });

  it("Figma error state: only ready time and food type missing", () => {
    const r = validateNewEvent(scenario({ readyTime: "", foodTypes: [] }), NOW);
    expect(r).toEqual({ ok: false, errors: { readyTime: "required", foodTypes: "required" } });
  });

  it("checks formats and ranges", () => {
    const errorsOf = (over: Partial<NewEventValues>) => {
      const r = validateNewEvent(scenario(over), NOW);
      return r.ok ? {} : r.errors;
    };
    expect(errorsOf({ title: "ab" })).toEqual({ title: "titleLength" });
    expect(errorsOf({ guests: "0" })).toEqual({ guests: "guestsRange" });
    expect(errorsOf({ guests: "12.5" })).toEqual({ guests: "wholeNumber" });
    expect(errorsOf({ guests: "-3" })).toEqual({ guests: "wholeNumber" });
    expect(errorsOf({ plannedKg: "99999" })).toEqual({ plannedKg: "quantityRange" });
    expect(errorsOf({ contactPhone: "123" })).toEqual({ contactPhone: "phone" });
    expect(errorsOf({ contactName: "   " })).toEqual({ contactName: "required" });
    expect(errorsOf({ notes: "x".repeat(301) })).toEqual({ notes: "tooLong" });
    expect(errorsOf({ date: "2026-10-20" })).toEqual({ date: "dateRange" }); // yesterday
    expect(errorsOf({ endTime: "23:15" })).toEqual({ endTime: "required" }); // not a slot
  });

  it("accepts Arabic-Indic digits and trims text", () => {
    const data = valid({ guests: "٣٠٠", plannedKg: "۲۱۰", contactPhone: "٠٥٠٠٠٠٠٠٠٠", title: "  حفل  " });
    expect(data.guests).toBe(300);
    expect(data.plannedKg).toBe(210);
    expect(data.contactPhone).toBe("0500000000");
    expect(data.title).toBe("حفل");
    expect(data.notes).toBeNull();
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
});

describe("C2 options and timestamps", () => {
  it("date options start today in Riyadh and cover the booking window", () => {
    const late = new Date("2026-10-21T22:30:00Z"); // already 22 Oct 01:30 in Riyadh
    expect(riyadhDate(late)).toBe("2026-10-22");
    const opts = eventDateOptions(NOW);
    expect(opts[0]).toBe("2026-10-21");
    expect(opts).toHaveLength(91);
  });

  it("time slots are every 30 minutes", () => {
    const slots = timeSlots();
    expect(slots).toHaveLength(48);
    expect(slots.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
  });

  it("keeps end time and food-ready time separate; earlier ready time = after midnight", () => {
    expect(eventTimestamps({ date: "2026-10-30", endTime: "23:00", readyTime: "23:30" })).toEqual({
      eventDate: "2026-10-30T00:00:00+03:00",
      endsAt: "2026-10-30T23:00:00+03:00",
      foodReadyAt: "2026-10-30T23:30:00+03:00",
    });
    expect(eventTimestamps({ date: "2026-10-31", endTime: "23:00", readyTime: "00:30" }).foodReadyAt).toBe(
      "2026-11-01T00:30:00+03:00",
    );
  });
});

describe("C2 saving", () => {
  const data = createSeed();
  const hallUser = data.users.find((u) => u.role === "hall_manager")!;

  it("next id continues the sequence (E-109 as in Figma)", () => {
    expect(nextEventId(data)).toBe("E-109");
  });

  it("builds a valid record + activity entry; new events always start as registered", () => {
    const { event, activity } = buildNewEvent(data, valid(), hallUser, NOW);
    expect(event).toMatchObject({
      id: "E-109",
      hallId: "hall-nakheel",
      status: "registered",
      expectedGuests: 300,
      plannedQuantityKg: 210,
      expectedSurplusKg: null, // the estimate comes from C3, never guessed
      foodTypes: ["hot_meals", "desserts"],
      createdBy: "demo-hall-01",
    });
    expect(activity).toMatchObject({ action: "event.created", entityId: "E-109", before: null, after: "registered" });

    const next = { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
    expect(datasetSchema.safeParse(next).success).toBe(true);
    expect(selectHallMetrics(next, "hall-nakheel").totalEvents).toBe(4);
    expect(selectHallEvents(next, "hall-nakheel").map((e) => e.id)).toEqual(["E-104", "E-107", "E-109", "E-103"]);
  });

  it("orders activity by real time even when offsets differ (Z vs +03:00)", () => {
    const { event, activity } = buildNewEvent(data, valid(), hallUser, new Date("2026-10-21T19:00:00Z"));
    // 19:00Z = 22:00 Riyadh → newer than the seed's 21:40+03:00 entry.
    const next = { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
    expect(selectHallActivity(next, "hall-nakheel", 1)[0]?.entityId).toBe("E-109");
  });

  it("refuses non-hall accounts", () => {
    const charity = data.users.find((u) => u.role === "charity_coordinator")!;
    expect(() => buildNewEvent(data, valid(), { ...charity, organizationId: null }, NOW)).toThrow();
  });
});

describe("store.createEvent", () => {
  afterEach(() => {
    __setRepositoryForTests(null);
    useDemoStore.setState({ status: "idle", data: null, currentUserId: null, flash: null });
  });

  const setup = (userId: string) => {
    const storage = createMemoryStorage();
    __setRepositoryForTests(createLocalRepository(storage));
    useDemoStore.setState({ status: "idle", data: null, currentUserId: null, flash: null });
    useDemoStore.getState().init();
    useDemoStore.getState().selectUser(userId);
    return storage;
  };

  it("persists the event, logs it and sets a one-time confirmation (Save as registered)", () => {
    const storage = setup("demo-hall-01");
    const id = useDemoStore.getState().createEvent(valid(), "registered");
    expect(id).toBe("E-109");
    const stored = JSON.parse(storage.getItem("hafez.demo.data.v1")!);
    expect(stored.events.some((e: { id: string }) => e.id === "E-109")).toBe(true);
    expect(useDemoStore.getState().flash).toEqual({
      kind: "eventCreated",
      eventId: "E-109",
      status: "registered",
      on: "/hall",
    });
    // "Save & make available" goes on to C3: no confirmation yet; the next event gets the next id.
    expect(useDemoStore.getState().createEvent(valid(), "forecast")).toBe("E-110");
    expect(useDemoStore.getState().flash).toBeNull();
  });

  it("does nothing for an account without event.create", () => {
    setup("demo-judge");
    expect(useDemoStore.getState().createEvent(valid(), "forecast")).toBeNull();
    expect(useDemoStore.getState().data?.events).toHaveLength(8);
  });
});
