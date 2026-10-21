import type { Assignment, DemoDataset, HallEvent, Inspection, SurplusReport } from "../types";

const time = (iso: string) => Date.parse(iso);

export interface FieldTask {
  kind: "event";
  event: HallEvent;
  assignment: Assignment;
  inspection: Inspection | null;
}

export interface ReportTask {
  kind: "report";
  report: SurplusReport;
}

/** E1 — only tasks assigned to this representative (blueprint: no view of other events, no self-assignment). */
export function selectMyTasks(data: DemoDataset, userId: string) {
  const events: FieldTask[] = data.assignments
    .filter((a) => a.representativeId === userId)
    .map((a) => ({
      kind: "event" as const,
      assignment: a,
      event: data.events.find((e) => e.id === a.eventId)!,
      inspection:
        data.inspections
          .filter((i) => i.eventId === a.eventId && i.representativeId === userId)
          .sort((x, y) => time(y.arrivedAt) - time(x.arrivedAt))[0] ?? null,
    }))
    .filter((t) => t.event);
  const reports: ReportTask[] = data.reports
    .filter((r) => r.inspection?.representativeId === userId)
    .map((r) => ({ kind: "report" as const, report: r }));

  const when = (t: FieldTask | ReportTask) =>
    t.kind === "event" ? time(t.assignment.plannedArrivalAt) : time(t.report.inspection!.plannedAt);
  const isOpen = (t: FieldTask | ReportTask) =>
    t.kind === "event" ? t.assignment.status === "active" : t.report.status === "accepted";
  const all = [...events, ...reports];
  return {
    inProgress: all.filter(isOpen).sort((a, b) => when(a) - when(b)),
    completed: all.filter((t) => !isOpen(t)).sort((a, b) => when(b) - when(a)),
  };
}

/** Next step for an event task (E1 card line / E2 steps). */
export function nextStep(t: FieldTask): "checkin" | "inspect" | "handover" | "awaiting_charity" | "done" {
  if (t.assignment.status !== "active") return "done";
  switch (t.event.status) {
    case "assigned":
      return "checkin";
    case "representative_arrived":
      return "inspect";
    case "inspected":
      return "handover";
    default:
      return "done";
  }
}
