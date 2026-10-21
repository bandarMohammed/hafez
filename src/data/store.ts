"use client";

import { create } from "zustand";
import { buildNewEvent } from "@/domain/newEvent";
import type { SaveMode, ValidNewEvent } from "@/domain/newEvent";
import { applyForecastDecision } from "@/domain/forecast";
import type { ForecastAssumptions, ForecastDecision } from "@/domain/forecast";
import { can } from "@/domain/permissions";
import type { DemoDataset, DemoUser, EventStatus } from "@/domain/types";
import type { CommandContext, CommandResult, FlashMessage } from "@/domain/workflow/core";
import type { DemoRepository } from "./repository";
import { createBrowserRepository } from "./repository";

/**
 * Client store: the single source of demo data + the current demo account.
 * Status lets every screen render explicit loading / error states (data only exists in the browser).
 */
export type DataStatus = "idle" | "ready" | "error";

export type Flash = (
  | { kind: "eventCreated"; eventId: string; status: EventStatus }
  | { kind: "eventPublished"; eventId: string; plannedKg: number; expectedSurplusKg: number }
  | ({ kind: "message" } & FlashMessage)
) & {
  /** Locale-free path where the confirmation is shown (the page the action navigates to). Omitted = current page. */
  on?: string;
};

interface DemoState {
  status: DataStatus;
  data: DemoDataset | null;
  currentUserId: string | null;
  init: () => void;
  selectUser: (userId: string) => void;
  /** Recovery from corrupted local data: restores the seed. */
  resetDemoData: () => void;
  /**
   * C2: saves a new event (status "registered") + its activity entry for the current hall account.
   * Returns the new id, or null if not allowed. "registered" mode also sets the C1 confirmation.
   */
  createEvent: (input: ValidNewEvent, mode: SaveMode) => string | null;
  /** C3: applies the hall decision and publishes the event. Returns false if not allowed. */
  decideForecast: (eventId: string, decision: ForecastDecision, assumptions: ForecastAssumptions) => boolean;
  /**
   * Runs a workflow command (src/domain/workflow) as the current account. On success the new data is saved
   * through the repository and the command message becomes a one-time confirmation; on failure nothing changes.
   */
  dispatch: <T>(command: (ctx: CommandContext) => CommandResult<T>, options?: { flashOn?: string }) => CommandResult<T>;
  /** One-time confirmation shown on the next screen (not persisted). */
  flash: Flash | null;
  clearFlash: () => void;
}

let repository: DemoRepository | null = null;
const repo = () => (repository ??= createBrowserRepository());

/** Test hook — inject a repository before first use. */
export function __setRepositoryForTests(r: DemoRepository | null) {
  repository = r;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  status: "idle",
  data: null,
  currentUserId: null,
  flash: null,

  init: () => {
    if (get().status !== "idle") return;
    const result = repo().load();
    const sessionId = repo().getSessionUserId();
    if (!result.ok) {
      set({ status: "error", data: null, currentUserId: sessionId });
      return;
    }
    const validSession = sessionId && result.data.users.some((u) => u.id === sessionId) ? sessionId : null;
    set({ status: "ready", data: result.data, currentUserId: validSession });
  },

  selectUser: (userId) => {
    repo().setSessionUserId(userId);
    set({ currentUserId: userId });
  },

  resetDemoData: () => {
    const data = repo().reset();
    set({ status: "ready", data });
  },

  createEvent: (input, mode) => {
    const { data, currentUserId } = get();
    const user = data?.users.find((u) => u.id === currentUserId);
    if (!data || !user || !can(user, "event.create")) return null;
    const { event, activity } = buildNewEvent(data, input, user, new Date());
    const next: DemoDataset = { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
    repo().save(next);
    set({
      data: next,
      flash:
        mode === "registered" ? { kind: "eventCreated", eventId: event.id, status: event.status, on: "/hall" } : null,
    });
    return event.id;
  },

  decideForecast: (eventId, decision, assumptions) => {
    const { data, currentUserId } = get();
    const user = data?.users.find((u) => u.id === currentUserId);
    if (!data || !user) return false;
    const result = applyForecastDecision(data, eventId, user, decision, assumptions, new Date());
    if (!result) return false;
    repo().save(result.data);
    set({
      data: result.data,
      flash: {
        kind: "eventPublished",
        eventId,
        plannedKg: result.event.plannedQuantityKg ?? 0,
        expectedSurplusKg: result.event.expectedSurplusKg ?? 0,
        on: "/hall",
      },
    });
    return true;
  },

  dispatch: (command, options) => {
    const { data, currentUserId } = get();
    const user = data?.users.find((u) => u.id === currentUserId);
    if (!data || !user) return { ok: false, error: "not_allowed" };
    const result = command({ data, user, now: new Date() });
    if (result.ok) {
      repo().save(result.data);
      set({
        data: result.data,
        flash: result.flash ? { kind: "message", ...result.flash, on: options?.flashOn ?? currentPath() } : get().flash,
      });
    }
    return result;
  },

  clearFlash: () => set({ flash: null }),
}));

/** Current demo account, or null when none is selected / data not ready. */
export function useCurrentUser(): DemoUser | null {
  return useDemoStore((s) =>
    s.data && s.currentUserId ? (s.data.users.find((u) => u.id === s.currentUserId) ?? null) : null,
  );
}

/** Current locale-free path ("/ar/charity/tasks" → "/charity/tasks"); used as the default flash target. */
function currentPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
}
