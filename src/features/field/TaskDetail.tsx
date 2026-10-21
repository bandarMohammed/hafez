"use client";

import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { can, eventRelations } from "@/domain/permissions";
import { selectEventRecords } from "@/domain/selectors/event";
import type { DemoDataset, DemoUser, HallEvent } from "@/domain/types";
import { checkIn, reportCannotAttend } from "@/domain/workflow/field";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailList } from "@/components/ui/DetailList";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useFormatters } from "@/features/common/useFormatters";
import { useField } from "./FieldTasks";

/** Resolves a task the current representative is allowed to see, or renders the not-found state. */
export function useTask(eventId: string) {
  const { user, data } = useField();
  const event = data?.events.find((e) => e.id === eventId);
  const rel = event && user && data ? eventRelations(data, event, user) : {};
  const visible = Boolean(user && event && can(user, "event.view", { kind: "event", event, rel }));
  return { user, data, event: visible ? event : undefined, rel };
}

export function TaskNotFound() {
  const t = useTranslations("fieldScreens.task");
  return (
    <StateMessage
      asPage
      icon="lock"
      tone="info"
      title={t("notFound")}
      body={t("notFoundBody")}
      actions={<ButtonLink href="/field">{t("back")}</ButtonLink>}
    />
  );
}

/** Figma E2 — task details & check-in. */
export function TaskDetail({ eventId }: { eventId: string }) {
  const { user, data, event } = useTask(eventId);
  if (!user || !data) return null;
  if (!event) return <TaskNotFound />;
  return <TaskView data={data} user={user} event={event} />;
}

function TaskView({ data, user, event }: { data: DemoDataset; user: DemoUser; event: HallEvent }) {
  const t = useTranslations("fieldScreens.task");
  const tf = useTranslations("newEvent.foodTypes");
  const locale = useLocale() as Locale;
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const records = selectEventRecords(data, event.id);
  const rel = eventRelations(data, event, user);
  const assignment = rel.assignment!;
  const hall = data.organizations.find((o) => o.id === event.hallId);
  const handover = records.handover;
  const canCheckIn = can(user, "task.checkin", { kind: "event", event, rel });
  const steps = [
    { key: "checkin", done: event.status !== "assigned" },
    { key: "inspect", done: !["assigned", "representative_arrived"].includes(event.status) },
    {
      key: "handover",
      done: Boolean(handover) || ["no_surplus", "not_collectable", "collected", "closed"].includes(event.status),
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/field", label: t("back") }}
        title={event.title[locale]}
        badge={<StatusBadge status={event.status} />}
        subtitle={
          <>
            <bdi>{event.id}</bdi> · {t("assignedBy", { charity: f.orgName(assignment.charityId) })}
          </>
        }
      />
      <Card className="p-5">
        <DetailList
          items={[
            { label: t("hall"), value: hall?.name[locale] ?? "—" },
            {
              label: t("location"),
              value: t("locationValue", {
                place: [hall?.district?.[locale], hall?.city[locale]].filter(Boolean).join("، "),
              }),
            },
            { label: t("plannedArrival"), value: f.dateTime(assignment.plannedArrivalAt) },
            { label: t("readyAt"), value: f.time(event.foodReadyAt) },
            event.foodTypes?.length
              ? { label: t("foodTypes"), value: event.foodTypes.map((x) => tf(x)).join(locale === "ar" ? "، " : ", ") }
              : null,
            {
              label: t("estimate"),
              value:
                event.expectedSurplusKg === null
                  ? t("noEstimate")
                  : t("estimateValue", { qty: f.kg(event.expectedSurplusKg) }),
            },
            event.contactName
              ? { label: t("contact"), value: `${event.contactName} · ${event.contactPhone ?? ""}` }
              : null,
          ]}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-body-strong text-heading">{t("nextSteps")}</h2>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-small">
              <Icon name={s.done ? "check" : "time"} size={18} className={s.done ? "text-success" : "text-muted"} />
              <span className={cn(s.done ? "text-ink" : "text-muted")}>
                {i + 1}. {t(`steps.${s.key}`)}
                {s.done ? <span className="sr-only"> ({t("done")})</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Actions follow the record state — one clear next step (blueprint §6: no skipping stages). */}
      <div className="flex flex-col gap-3">
        {canCheckIn ? (
          <>
            <Button fullWidth onClick={() => dispatch((c) => checkIn(c, event.id))}>
              {t("checkIn")}
            </Button>
            <Button fullWidth variant="ghost" onClick={() => dispatch((c) => reportCannotAttend(c, event.id))}>
              {t("cannotAttend")}
            </Button>
          </>
        ) : event.status === "representative_arrived" ? (
          <ButtonLink fullWidth href={`/field/tasks/${event.id}/inspect`}>
            {t("goInspect")}
          </ButtonLink>
        ) : event.status === "inspected" && (!handover || handover.dispute) ? (
          <ButtonLink fullWidth href={`/field/tasks/${event.id}/handover`}>
            {handover?.dispute ? t("fixHandover") : t("goHandover")}
          </ButtonLink>
        ) : event.status === "inspected" && handover ? (
          <p className="rounded-md bg-selected px-4 py-3 text-small text-heading">
            {t("waitingCharity", { qty: f.kg(handover.actualQuantity) })}
          </p>
        ) : event.status === "no_surplus" || event.status === "not_collectable" ? (
          <ButtonLink fullWidth variant="secondary" href={`/field/tasks/${event.id}/result`}>
            {t("viewResult")}
          </ButtonLink>
        ) : event.status === "collected" ? (
          <p className="rounded-md bg-success-bg px-4 py-3 text-small text-success">
            {t("collected", { qty: f.kg(handover?.actualQuantity ?? 0) })}
          </p>
        ) : null}
        {handover?.dispute ? (
          <p className="rounded-md bg-warning-bg px-4 py-3 text-small text-warning">
            {t("disputed", { note: handover.dispute.note })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Figma E5 — documented visit with no received weight (no surplus / not suitable). */
export function TaskResult({ eventId }: { eventId: string }) {
  const { user, data, event } = useTask(eventId);
  if (!user || !data) return null;
  if (!event) return <TaskNotFound />;
  return <ResultView data={data} event={event} />;
}

function ResultView({ data, event }: { data: DemoDataset; event: HallEvent }) {
  const t = useTranslations("fieldScreens.result");
  const tr = useTranslations("field");
  const f = useFormatters(data);
  const records = selectEventRecords(data, event.id);
  const i = records.inspection;
  if (!i || i.status !== "final" || (event.status !== "no_surplus" && event.status !== "not_collectable")) {
    return <TaskNotFound />;
  }
  const kind = event.status === "no_surplus" ? "noSurplus" : "notCollectable";
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <span className="inline-flex size-18 items-center justify-center rounded-full bg-selected text-heading">
        <Icon name="check" size={36} />
      </span>
      <h1 className="text-h3 text-heading">{t(`${kind}.title`)}</h1>
      <p className="text-small text-muted">{t(`${kind}.body`, { event: event.id })}</p>
      <Card className="w-full p-5 text-start">
        <DetailList
          items={[
            { label: t("outcome"), value: tr(`outcomes.${i.outcome!}.title`) },
            i.reason ? { label: t("reason"), value: tr(`reasons.${i.reason}`) } : null,
            { label: t("visitTime"), value: f.dateTime(i.inspectedAt ?? i.arrivedAt) },
            { label: t("weight"), value: t("noWeight") },
          ]}
        />
      </Card>
      <ButtonLink href="/field" fullWidth>
        {t("back")}
      </ButtonLink>
    </div>
  );
}
