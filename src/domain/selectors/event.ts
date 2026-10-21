import type { DemoDataset } from "../types";

const time = (iso: string) => Date.parse(iso);

/**
 * Everything recorded about one event across roles — the single source for every detail screen
 * (hall C, charity D, field E), so the same record shows the same state everywhere.
 */
export function selectEventRecords(data: DemoDataset, eventId: string) {
  const event = data.events.find((e) => e.id === eventId);
  return {
    event,
    coordination:
      data.coordination
        .filter((c) => c.eventId === eventId && c.status !== "declined")
        .sort((a, b) => time(b.createdAt) - time(a.createdAt))[0] ?? null,
    declines: data.coordination.filter((c) => c.eventId === eventId && c.status === "declined"),
    assignment:
      data.assignments
        .filter((a) => a.eventId === eventId)
        .sort((a, b) => time(b.assignedAt) - time(a.assignedAt))[0] ?? null,
    inspection:
      data.inspections.filter((i) => i.eventId === eventId).sort((a, b) => time(b.arrivedAt) - time(a.arrivedAt))[0] ??
      null,
    handover: data.handovers.find((h) => h.eventId === eventId) ?? null,
    activity: data.activity
      .filter((a) => a.entityType === "event" && a.entityId === eventId)
      .sort((a, b) => time(b.timestamp) - time(a.timestamp)),
  };
}
