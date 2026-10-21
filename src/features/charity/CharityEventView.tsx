"use client";

import { useLocale, useTranslations } from "next-intl";
import { can, eventRelations } from "@/domain/permissions";
import { selectEventRecords } from "@/domain/selectors/event";
import type { Locale } from "@/i18n/routing";
import { ButtonLink } from "@/components/ui/Button";
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
import { useCharity } from "./Opportunities";

/** A task coordinated by this charity: path, coordination, inspection and handover (read-only). */
export function CharityEventView({ eventId }: { eventId: string }) {
  const t = useTranslations("charity.task");
  const locale = useLocale() as Locale;
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const records = selectEventRecords(data, eventId);
  const event = records.event;
  if (!event || !can(user, "event.view", { kind: "event", event, rel: eventRelations(data, event, user) })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/charity/tasks">{t("back")}</ButtonLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/tasks", label: t("back") }}
        title={
          <>
            {event.title[locale]} · <bdi>{event.id}</bdi>
          </>
        }
        badge={<StatusBadge status={event.status} />}
        subtitle={t("readOnly")}
      />
      <EventStepper status={event.status} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <EventDetailsPanel data={data} records={records} />
          <CoordinationPanel data={data} records={records} />
          <InspectionPanel data={data} records={records} />
          <HandoverPanel data={data} records={records} />
        </div>
        <Panel title={t("logTitle")} titleId="ct-log">
          <ActivityList data={data} entries={records.activity} />
        </Panel>
      </div>
    </div>
  );
}
