"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import type { Locale } from "@/i18n/routing";
import { forecastAvailability } from "@/domain/forecast";
import { can } from "@/domain/permissions";
import { selectEventRecords } from "@/domain/selectors/event";
import { confirmHandoverByHall } from "@/domain/workflow/hall";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityList } from "@/features/common/ActivityList";
import { EventStepper } from "@/features/common/EventStepper";
import {
  CoordinationPanel,
  EventDetailsPanel,
  HandoverPanel,
  InspectionPanel,
} from "@/features/common/EventRecordPanels";

/**
 * Hall event detail (blueprint §9 "تفاصيل المناسبة — حقول قاعته"; no dedicated C frame — built from the Figma
 * B2/D4 patterns). Shows the shared record as it moves through D and E, plus the hall-side handover confirmation.
 */
export function HallEventDetail({ eventId }: { eventId: string }) {
  const t = useTranslations("hallDetail");
  const tStates = useTranslations("states.notFound");
  const locale = useLocale() as Locale;
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const dispatch = useDemoStore((s) => s.dispatch);
  if (!user || !data) return null;

  const records = selectEventRecords(data, eventId);
  const event = records.event;
  if (!event || !can(user, "event.view", { kind: "event", event })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={tStates("title")}
        body={tStates("body")}
        actions={<ButtonLink href="/hall/events">{t("backToList")}</ButtonLink>}
      />
    );
  }
  const canEdit = can(user, "event.edit", { kind: "event", event });
  const canForecast = forecastAvailability(user, event) === "ok";
  const handover = records.handover;
  const canConfirm = handover ? can(user, "handover.confirm_hall", { kind: "handover", handover, event }) : false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        crumbs={t("crumbs", { event: event.id })}
        title={
          <>
            {event.title[locale]} · <bdi>{event.id}</bdi>
          </>
        }
        badge={<StatusBadge status={event.status} />}
        subtitle={canEdit ? t("editableHint") : t("lockedHint")}
        actions={
          <>
            {canForecast ? (
              <ButtonLink href={`/hall/events/${event.id}/forecast`}>{t("continueForecast")}</ButtonLink>
            ) : null}
            {canEdit ? (
              <ButtonLink href={`/hall/events/${event.id}/edit`} variant="secondary">
                {t("edit")}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <EventStepper status={event.status} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <EventDetailsPanel data={data} records={records} />
          <CoordinationPanel data={data} records={records} />
          <InspectionPanel data={data} records={records} />
          <HandoverPanel data={data} records={records}>
            {canConfirm && handover ? (
              <div className="mt-4 flex flex-col gap-3 rounded-md bg-selected p-4">
                <p className="text-small text-heading">{t("confirmHint")}</p>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => dispatch((c) => confirmHandoverByHall(c, handover.id))}
                >
                  {t("confirmHall")}
                </Button>
              </div>
            ) : null}
          </HandoverPanel>
        </div>
        <Panel title={t("activityTitle")} titleId="ev-activity">
          <ActivityList data={data} entries={records.activity} />
        </Panel>
      </div>
    </div>
  );
}
