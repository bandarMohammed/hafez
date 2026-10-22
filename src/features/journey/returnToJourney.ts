"use client";

import { useSyncExternalStore } from "react";

/**
 * "Back to the journey" — remembered only in this browser tab (sessionStorage), never in the demo data,
 * so opening a role screen from the journey and coming back changes nothing on the platform.
 */
const KEY = "hafez.journey.return";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the return button simply doesn't appear.
  }
  listeners.forEach((l) => l());
}

export const markCameFromJourney = () => write(true);
export const clearCameFromJourney = () => write(false);

export function useCameFromJourney(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
}
