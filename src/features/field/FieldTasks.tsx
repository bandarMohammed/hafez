"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { selectMyTasks } from "@/domain/selectors/field";
import type { FieldTask, ReportTask } from "@/domain/selectors/field";
import type { DemoDataset, DemoUser } from "@/domain/types";
import type { Locale } from "@/i18n/routing";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useFormatters } from "@/features/common/useFormatters";

export function useField() {
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  return { user, data };
}

/** Figma E1 — only tasks assigned to you; you can't see other events or assign yourself. */
export function FieldTasksScreen() {
  const { user, data } = useField();
  if (!user || !data) return null;
  return <TasksView data={data} user={user} />;
}

function TasksView({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("fieldScreens.tasks");
  const { inProgress, completed } = selectMyTasks(data, user.id);
  const list = (items: Array<FieldTask | ReportTask>) => (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((task) => (
        <li key={task.kind === "event" ? task.event.id : task.report.id}>
          {task.kind === "event" ? (
            <EventTaskCard data={data} task={task} />
          ) : (
            <ReportTaskCard data={data} task={task} />
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle")} />
      <section aria-labelledby="f-open" className="flex flex-col gap-3">
        <h2 id="f-open" className="text-body-strong text-heading">
          {t("inProgress")}
        </h2>
        {inProgress.length ? (
          list(inProgress)
        ) : (
          <Card>
            <StateMessage icon="listChecks" title={t("emptyTitle")} body={t("emptyBody")} />
          </Card>
        )}
      </section>
      <section aria-labelledby="f-done" className="flex flex-col gap-3">
        <h2 id="f-done" className="text-body-strong text-heading">
          {t("completed")}
        </h2>
        {completed.length ? list(completed) : <p className="text-small text-muted">{t("noCompleted")}</p>}
      </section>
    </div>
  );
}

function EventTaskCard({ data, task }: { data: DemoDataset; task: FieldTask }) {
  const t = useTranslations("fieldScreens.tasks");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const { event, assignment, inspection } = task;
  const hall = data.organizations.find((o) => o.id === event.hallId);
  const handover = data.handovers.find((h) => h.eventId === event.id);
  const place = `${hall?.name[locale] ?? ""} · ${[hall?.district?.[locale], hall?.city[locale]].filter(Boolean).join("، ")}`;
  let when: string;
  let next: string;
  if (assignment.status === "completed") {
    when = handover
      ? t("handedAt", { date: f.date(handover.handedOverAt), time: f.time(handover.handedOverAt) })
      : t("visitAt", {
          date: f.date(inspection?.inspectedAt ?? inspection?.arrivedAt ?? assignment.plannedArrivalAt),
          time: f.time(inspection?.inspectedAt ?? inspection?.arrivedAt ?? assignment.plannedArrivalAt),
        });
    next = handover ? t("actual", { qty: f.kg(handover.actualQuantity) }) : t("noWeight");
  } else if (event.status === "assigned") {
    when = t("planned", { date: f.date(assignment.plannedArrivalAt), time: f.time(assignment.plannedArrivalAt) });
    next = event.expectedSurplusKg === null ? t("noEstimate") : t("estimate", { qty: f.kg(event.expectedSurplusKg) });
  } else {
    when = t("arrived", {
      time: f.time(inspection?.arrivedAt ?? assignment.plannedArrivalAt),
      ready: f.time(event.foodReadyAt),
    });
    next =
      event.status === "representative_arrived"
        ? t("nextInspect")
        : handover?.dispute
          ? t("nextFix")
          : handover
            ? t("nextCharity")
            : t("nextHandover");
  }
  return (
    <RecordCard
      href={`/field/tasks/${event.id}`}
      highlight={assignment.status === "active"}
      title={
        <>
          {event.title[locale]} · <bdi>{event.id}</bdi>
        </>
      }
      badge={<StatusBadge status={event.status} />}
      meta={[
        { icon: "halls", text: place },
        { icon: "time", text: when },
        { icon: "listChecks", text: next },
      ]}
    />
  );
}

function ReportTaskCard({ data, task }: { data: DemoDataset; task: ReportTask }) {
  const t = useTranslations("fieldScreens.tasks");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const r = task.report;
  return (
    <RecordCard
      href={`/field/reports/${r.id}`}
      highlight={r.status === "accepted" && !r.inspection?.result}
      title={
        <>
          {t("reportTitle", { food: r.foodType })} · <bdi>{r.id}</bdi>
        </>
      }
      badge={<RequestStatusBadge status={r.status} />}
      meta={[
        { icon: "location", text: t("reportArea", { area: r.area[locale] }) },
        {
          icon: "time",
          text: t("planned", { date: f.date(r.inspection!.plannedAt), time: f.time(r.inspection!.plannedAt) }),
        },
        {
          icon: "listChecks",
          text: r.inspection?.result
            ? t("reportDone", { outcome: t(`reportOutcome.${r.inspection.result.outcome}`) })
            : t("reportNext"),
        },
      ]}
    />
  );
}
