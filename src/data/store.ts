"use client";

import { create } from "zustand";
import type { DemoDataset, DemoUser } from "@/domain/types";
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
}));

/** Current demo account, or null when none is selected / data not ready. */
export function useCurrentUser(): DemoUser | null {
  return useDemoStore((s) =>
    s.data && s.currentUserId ? (s.data.users.find((u) => u.id === s.currentUserId) ?? null) : null,
  );
}
