"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { selectHallActivity, selectHallEvents, selectHallMetrics } from "@/domain/hall";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { StateMessage } from "@/components/ui/StateMessage";
import { HallEventsCards, HallEventsTable } from "./HallEventsList";
import { HallActivityPanel, HallRulesPanel } from "./HallPanels";

/** Figma C1 — hall manager home (frames 19:974 AR / 19:1219 EN). Rendered inside WorkspaceGate, so user + data exist. */
export function HallHome() {
  const t = useTranslations("hall");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const data = useDemoStore((s) => s.data);
  const user = useCurrentUser();
  if (!data || !user?.organizationId) return null;

  const hall = data.organizations.find((o) => o.id === user.organizationId);
  if (!hall) return null;

  const events = selectHallEvents(data, hall.id);
  const metrics = selectHallMetrics(data, hall.id);
  const activity = selectHallActivity(data, hall.id, 2);
  const canCreate = can(user, "event.create");
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-muted">{t("crumbs")}</p>
          <h1 className="text-h2 text-heading">{t("welcome", { hall: hall.name[locale] })}</h1>
          <p className="text-small text-muted">
            {t("scope", { district: hall.district?.[locale] ?? "", city: hall.city[locale] })}
          </p>
        </div>
        {canCreate ? (
          <ButtonLink href="/hall/events/new" className="w-full md:w-auto">
            {t("newEvent")}
          </ButtonLink>
        ) : null}
      </header>

      <section aria-label={t("metrics.total")} className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon="events"
          value={n(metrics.totalEvents)}
          label={t("metrics.total")}
          source={tc("computedFromDemo")}
        />
        <MetricCard
          icon="charities"
          value={n(metrics.awaitingCharity)}
          label={t("metrics.awaiting")}
          source={tc("computedFromDemo")}
        />
        <MetricCard
          icon="pickup"
          value={n(metrics.completedHandovers)}
          label={t("metrics.completed")}
          source={tc("computedFromDemo")}
        />
      </section>

      <Card className="overflow-hidden">
        <section aria-labelledby="hall-events">
          <div className="flex flex-col gap-1 px-6 pt-6 pb-4">
            <h2 id="hall-events" className="text-h4 text-heading">
              {t("events.title")}
            </h2>
            <p className="text-caption text-muted">{t("events.hint")}</p>
          </div>
          {events.length === 0 ? (
            <StateMessage
              icon="events"
              title={t("empty.title")}
              body={t("empty.body")}
              actions={canCreate ? <ButtonLink href="/hall/events/new">{t("newEvent")}</ButtonLink> : undefined}
            />
          ) : (
            <>
              <HallEventsTable data={data} user={user} events={events} />
              <HallEventsCards data={data} user={user} events={events} />
            </>
          )}
        </section>
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <HallRulesPanel />
        <HallActivityPanel data={data} entries={activity} />
      </div>
    </div>
  );
}
