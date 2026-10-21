"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { selectHallActivity, selectHallEvents } from "@/domain/hall";
import { can } from "@/domain/permissions";
import { confirmHandoverByHall } from "@/domain/workflow/hall";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/Choice";
import { DetailList } from "@/components/ui/DetailList";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityList } from "@/features/common/ActivityList";
import { ProfileScreen } from "@/features/common/ProfileScreen";
import { useFormatters } from "@/features/common/useFormatters";
import { HallEventsCards, HallEventsTable } from "./HallEventsList";

function useHall() {
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const hall = data?.organizations.find((o) => o.id === user?.organizationId);
  return { user, data, hall };
}

/** "My hall's events" — every event of this hall with a status filter (C1 table/cards, full list). */
export function HallEventsScreen() {
  const t = useTranslations("hallScreens.events");
  const th = useTranslations("hall");
  const { user, data, hall } = useHall();
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");
  if (!user || !data || !hall) return null;
  const all = selectHallEvents(data, hall.id);
  const isFinished = (s: (typeof all)[number]["status"]) => DEMO_CONFIG.finishedStatuses.includes(s);
  const events = all.filter((e) =>
    filter === "all" ? true : filter === "active" ? !isFinished(e.status) : isFinished(e.status),
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        crumbs={t("crumbs")}
        title={t("title")}
        subtitle={th("events.hint")}
        actions={can(user, "event.create") ? <ButtonLink href="/hall/events/new">{th("newEvent")}</ButtonLink> : null}
      />
      <FilterChips
        label={t("filterLabel")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("all", { count: all.length }) },
          { value: "active", label: t("active", { count: all.filter((e) => !isFinished(e.status)).length }) },
          { value: "finished", label: t("finished", { count: all.filter((e) => isFinished(e.status)).length }) },
        ]}
      />
      <Card className="overflow-hidden">
        {events.length === 0 ? (
          <StateMessage icon="events" title={t("empty")} />
        ) : (
          <>
            <HallEventsTable data={data} user={user} events={events} />
            <HallEventsCards data={data} user={user} events={events} />
          </>
        )}
      </Card>
    </div>
  );
}

/** Hall handovers — blueprint matrix: the hall confirms its side only ("تأكيد طرف القاعة"). */
export function HallHandoversScreen() {
  const { user, data, hall } = useHall();
  if (!user || !data || !hall) return null;
  return <HallHandoversList user={user} data={data} hallId={hall.id} />;
}

function HallHandoversList({
  user,
  data,
  hallId,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUser>>;
  data: Parameters<typeof useFormatters>[0];
  hallId: string;
}) {
  const t = useTranslations("hallScreens.handovers");
  const locale = useLocale() as Locale;
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const hall = { id: hallId };
  const items = data.handovers
    .map((h) => ({ h, e: data.events.find((x) => x.id === h.eventId)! }))
    .filter(({ e }) => e && e.hallId === hall.id)
    .sort((a, b) => Date.parse(b.h.handedOverAt) - Date.parse(a.h.handedOverAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
      {items.length === 0 ? (
        <Card>
          <StateMessage icon="pickup" title={t("emptyTitle")} body={t("emptyBody")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map(({ h, e }) => {
            const canConfirm = can(user, "handover.confirm_hall", { kind: "handover", handover: h, event: e });
            return (
              <li key={h.id}>
                <RecordCard
                  title={
                    <>
                      {e.title[locale]} · <bdi>{e.id}</bdi>
                    </>
                  }
                  href={`/hall/events/${e.id}`}
                  badge={<StatusBadge status={e.status} />}
                  meta={[
                    { icon: "weight", text: t("actual", { qty: f.kg(h.actualQuantity) }) },
                    { icon: "time", text: f.dateTime(h.handedOverAt) },
                    { icon: "charities", text: f.orgName(h.receivingOrganizationId) },
                    {
                      icon: "check",
                      text: [
                        h.charityConfirmedAt ? t("charityConfirmed") : t("charityPending"),
                        h.hallConfirmedAt ? t("hallConfirmed") : t("hallPending"),
                      ].join(" · "),
                    },
                  ]}
                >
                  {canConfirm ? (
                    <Button variant="secondary" onClick={() => dispatch((c) => confirmHandoverByHall(c, h.id))}>
                      {t("confirm")}
                    </Button>
                  ) : null}
                </RecordCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Hall activity log (blueprint matrix: "سجل قاعته"). */
export function HallActivityScreen() {
  const t = useTranslations("hallScreens.activity");
  const { user, data, hall } = useHall();
  if (!user || !data || !hall) return null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
      <Panel title={t("listTitle")} titleId="hall-log">
        <ActivityList data={data} entries={selectHallActivity(data, hall.id, 500)} />
      </Panel>
    </div>
  );
}

/** Hall profile (blueprint §9 "ملف القاعة فقط") on the Figma E7 profile pattern. */
export function HallProfileScreen() {
  const t = useTranslations("hallScreens.profile");
  const locale = useLocale() as Locale;
  const { hall } = useHall();
  if (!hall) return null;
  return (
    <ProfileScreen
      role="hall"
      extra={
        <section aria-labelledby="hall-info" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="hall-info" className="mb-2 text-body-strong text-heading">
            {t("infoTitle")}
          </h2>
          <DetailList
            items={[
              { label: t("name"), value: hall.name[locale] },
              { label: t("city"), value: hall.city[locale] },
              { label: t("district"), value: hall.district?.[locale] ?? "—" },
            ]}
          />
        </section>
      }
    />
  );
}
