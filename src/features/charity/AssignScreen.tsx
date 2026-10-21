"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { can, eventRelations } from "@/domain/permissions";
import { arrivalOptions, selectTeam } from "@/domain/selectors/charity";
import { selectEventRecords } from "@/domain/selectors/event";
import type { DemoDataset, DemoUser, HallEvent } from "@/domain/types";
import { assignRepresentative } from "@/domain/workflow/charity";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { RadioCards } from "@/components/ui/Choice";
import { Field, SelectInput, describedBy } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { ActivityList } from "@/features/common/ActivityList";
import { EventStepper } from "@/features/common/EventStepper";
import { useFormatters } from "@/features/common/useFormatters";
import { useCharity } from "./Opportunities";

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

/** Figma D4 — assign a representative from the charity's own team. */
export function AssignScreen({ eventId }: { eventId: string }) {
  const t = useTranslations("charity.assign");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const event = data.events.find((e) => e.id === eventId);
  const rel = event ? eventRelations(data, event, user) : {};
  if (!event || !can(user, "event.view", { kind: "event", event, rel })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/charity/opportunities">{t("backToOpportunities")}</ButtonLink>}
      />
    );
  }
  if (!can(user, "assignment.create", { kind: "event", event, rel })) {
    return (
      <StateMessage
        asPage
        icon="info"
        tone="info"
        title={t("alreadyTitle", { event: event.id })}
        body={t("alreadyBody")}
        actions={<ButtonLink href="/charity/tasks">{t("goTasks")}</ButtonLink>}
      />
    );
  }
  return <AssignForm data={data} user={user} event={event} />;
}

function AssignForm({ data, user, event }: { data: DemoDataset; user: DemoUser; event: HallEvent }) {
  const t = useTranslations("charity.assign");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const team = selectTeam(data, user.organizationId!, event.foodReadyAt);
  const options = arrivalOptions(event.foodReadyAt);
  const [repId, setRepId] = useState<string | null>(team.find((m) => !m.availableUntil)?.user.id ?? null);
  const [arrival, setArrival] = useState(options.find((o) => o.offsetMin === -15)?.iso ?? options[0]!.iso);
  const [errors, setErrors] = useState<{ rep?: string; arrival?: string }>({});
  const records = selectEventRecords(data, event.id);
  const hall = data.organizations.find((o) => o.id === event.hallId);

  const submit = () => {
    const member = team.find((m) => m.user.id === repId);
    const next: typeof errors = {};
    if (!member) next.rep = t("repRequired");
    else if (member.availableUntil && hhmm(arrival) >= member.availableUntil)
      next.rep = t("repUnavailable", { time: member.availableUntil });
    setErrors(next);
    if (Object.keys(next).length) return;
    const r = dispatch(
      (c) => assignRepresentative(c, event.id, { representativeId: repId!, plannedArrivalAt: arrival }),
      {
        flashOn: "/charity/opportunities",
      },
    );
    if (r.ok) router.push("/charity/opportunities");
  };

  const offsetLabel = (m: number) =>
    m === 0 ? t("atReady") : m < 0 ? t("beforeReady", { minutes: -m }) : t("afterReady", { minutes: m });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        crumbs={t("crumbs", { event: event.id })}
        title={t("title", { title: event.title[locale] })}
        subtitle={t("subtitle", {
          hall: hall?.name[locale] ?? "",
          date: f.date(event.eventDate),
          time: f.time(event.foodReadyAt),
        })}
        actions={
          <Link
            href={`/charity/opportunities/${event.id}/decline`}
            className="inline-flex min-h-12 items-center px-2 text-button text-action hover:text-action-hover"
          >
            {t("decline")}
          </Link>
        }
      />
      <EventStepper status={event.status} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={t("chooseTitle")} titleId="assign-choose">
          <p className="-mt-2 mb-4 text-small text-muted">{t("chooseHint")}</p>
          <RadioCards
            name="rep"
            legend={t("repLegend")}
            value={repId}
            onChange={(v) => {
              setRepId(v);
              setErrors({});
            }}
            error={errors.rep}
            errorId="assign-rep-error"
            options={team.map((m) => ({
              value: m.user.id,
              title: m.user.displayName?.[locale] ?? m.user.id,
              description: m.availableUntil
                ? t("unavailableAfter", { time: m.availableUntil })
                : t("available", { count: m.tasksOnDay }),
            }))}
          />
          <div className="mt-5">
            <Field id="assign-arrival" label={t("arrivalLabel")} required hint={t("arrivalHint")}>
              <SelectInput
                id="assign-arrival"
                value={arrival}
                aria-describedby={describedBy("assign-arrival", { hint: t("arrivalHint") })}
                onChange={(e) => {
                  setArrival(e.target.value);
                  setErrors({});
                }}
              >
                {options.map((o) => (
                  <option key={o.iso} value={o.iso}>
                    {f.time(o.iso)} — {offsetLabel(o.offsetMin)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <Button onClick={submit}>{t("confirm")}</Button>
            <ButtonLink href="/charity/opportunities" variant="ghost">
              {t("cancel")}
            </ButtonLink>
          </div>
        </Panel>
        <Panel title={t("seesTitle")} titleId="assign-sees">
          <ul className="mb-5 flex list-disc flex-col gap-2 ps-5 text-small text-ink">
            <li>{t("sees1")}</li>
            <li>{t("sees2")}</li>
            <li>{t("sees3")}</li>
          </ul>
          <ActivityList data={data} entries={records.activity.slice(0, 2)} />
        </Panel>
      </div>
    </div>
  );
}
