"use client";

import { create } from "zustand";
import { buildNewEvent } from "@/domain/newEvent";
import type { SaveMode, ValidNewEvent } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import type { DemoDataset, DemoUser, EventStatus } from "@/domain/types";
import type { DemoRepository } from "./repository";
import { createBrowserRepository } from "./repository";

/**
 * Client store: the single source of demo data + the current demo account.
 * Status lets every screen render explicit loading / error states (data only exists in the browser).
 */
export type DataStatus = "idle" | "ready" | "error";

interface DemoState {
  status: DataStatus;
  data: DemoDataset | null;
  currentUserId: string | null;
  init: () => void;
  selectUser: (userId: string) => void;
  /** Recovery from corrupted local data: restores the seed. */
  resetDemoData: () => void;
  /** C2: saves a new event + its activity entry for the current hall account. Returns the new id, or null if not allowed. */
  createEvent: (input: ValidNewEvent, mode: SaveMode) => string | null;
  /** One-time confirmation shown on the next screen (not persisted). */
  flash: { kind: "eventCreated"; eventId: string; status: EventStatus } | null;
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
    const { event, activity } = buildNewEvent(data, input, user, mode, new Date());
    const next: DemoDataset = { ...data, events: [...data.events, event], activity: [...data.activity, activity] };
    repo().save(next);
    set({ data: next, flash: { kind: "eventCreated", eventId: event.id, status: event.status } });
    return event.id;
  },

  clearFlash: () => set({ flash: null }),
}));

/** Current demo account, or null when none is selected / data not ready. */
export function useCurrentUser(): DemoUser | null {
  return useDemoStore((s) =>
    s.data && s.currentUserId ? (s.data.users.find((u) => u.id === s.currentUserId) ?? null) : null,
  );
}
