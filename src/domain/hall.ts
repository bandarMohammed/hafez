import { DEMO_CONFIG } from "@/config/demo";
import type { ActivityLogEntry, DemoDataset, HallEvent } from "./types";

/**
 * Pure selectors for the hall-manager workspace (Figma C1).
 * Blueprint §5: every metric must be derived from records — never hard-coded in UI.
 */

const isFinished = (e: HallEvent) => DEMO_CONFIG.finishedStatuses.includes(e.status);

/** Events of one hall only; active first (by event date), then finished (most recent first). */
export function selectHallEvents(data: DemoDataset, hallId: string): HallEvent[] {
  const mine = data.events.filter((e) => e.hallId === hallId);
  const active = mine.filter((e) => !isFinished(e)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const finished = mine.filter(isFinished).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return [...active, ...finished];
}

export interface HallMetrics {
  /** All events registered by this hall. */
  totalEvents: number;
  /** Events waiting for a charity decision. */
  awaitingCharity: number;
  /** Handovers of this hall's events confirmed by the receiving side. */
  completedHandovers: number;
}

export function selectHallMetrics(data: DemoDataset, hallId: string): HallMetrics {
  const events = data.events.filter((e) => e.hallId === hallId);
  const ids = new Set(events.map((e) => e.id));
  return {
    totalEvents: events.length,
    awaitingCharity: events.filter((e) => e.status === "awaiting_charity").length,
    completedHandovers: data.handovers.filter((h) => ids.has(h.eventId) && h.confirmationStatus !== "pending").length,
  };
}

/** Activity on this hall's events, newest first. */
export function selectHallActivity(data: DemoDataset, hallId: string, limit = 5): ActivityLogEntry[] {
  const ids = new Set(data.events.filter((e) => e.hallId === hallId).map((e) => e.id));
  return data.activity
    .filter((a) => a.entityType === "event" && ids.has(a.entityId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

/** Latest activity entry per event — feeds the "Last update" column. */
export function selectLatestActivityByEvent(data: DemoDataset): Map<string, ActivityLogEntry> {
  const latest = new Map<string, ActivityLogEntry>();
  for (const entry of data.activity) {
    const current = latest.get(entry.entityId);
    if (!current || entry.timestamp > current.timestamp) latest.set(entry.entityId, entry);
  }
  return latest;
}
