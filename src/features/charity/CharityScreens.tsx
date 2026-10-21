"use client";

import { useLocale, useTranslations } from "next-intl";
import { distributedKg } from "@/domain/selectors/beneficiary";
import {
  selectCharityHandovers,
  selectCharityListings,
  selectCharityReports,
  selectCharityTasks,
  selectOpportunities,
  selectTeam,
} from "@/domain/selectors/charity";
import type { DemoDataset, DemoUser } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Card, Panel } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/components/ui/Icon";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityList } from "@/features/common/ActivityList";
import { useFormatters } from "@/features/common/useFormatters";
import { useCharity } from "./Opportunities";

/** Counts that drive the charity home (all derived from records). */
function charityCounts(data: DemoDataset, user: DemoUser) {
  const charityId = user.organizationId!;
  const opps = selectOpportunities(data, user);
  const tasks = selectCharityTasks(data, charityId);
  const handovers = selectCharityHandovers(data, charityId);
  const listings = selectCharityListings(data, charityId);
  const listingIds = new Set(listings.map((l) => l.id));
  const reports = selectCharityReports(data, charityId);
  return {
    opportunities: opps.filter((e) => e.status === "available").length,
    needsAssignment: tasks.needsAssignment.length,
    active: tasks.active.length,
    handoversPending: handovers.pending.length,
    requestsPending: data.requests.filter((r) => listingIds.has(r.listingId) && r.status === "pending").length,
    reportsToReview: reports.filter((r) => r.status === "pending" || (r.status === "accepted" && r.inspection?.result))
      .length,
    deliveredKg: data.handovers
      .filter((h) => h.receivingOrganizationId === charityId && h.charityConfirmedAt)
      .reduce((s, h) => s + (h.unit === "kg" ? h.actualQuantity : 0), 0),
    distributedKg: listings.reduce((s, l) => s + distributedKg(data, l), 0),
    rescuedKg: reports.reduce((s, r) => s + (r.rescue?.actualKg ?? 0), 0),
  };
}

/** Charity home — blueprint §9 "فرص ومهام جمعيته" (no dedicated D frame; built from Figma metric/list patterns). */
export function CharityHome() {
  const { user, data, charity } = useCharity();
  if (!user || !data || !charity) return null;
  return <CharityHomeView data={data} user={user} charityName={charity.name} />;
}

function CharityHomeView({
  data,
  user,
  charityName,
}: {
  data: DemoDataset;
  user: DemoUser;
  charityName: { ar: string; en: string };
}) {
  const t = useTranslations("charity.home");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const c = charityCounts(data, user);
  const actions: Array<{ href: string; icon: IconKey; label: string; count: number }> = [
    { href: "/charity/opportunities", icon: "package", label: t("actions.opportunities"), count: c.opportunities },
    { href: "/charity/tasks", icon: "charities", label: t("actions.needsAssignment"), count: c.needsAssignment },
    { href: "/charity/handovers", icon: "pickup", label: t("actions.handovers"), count: c.handoversPending },
    { href: "/charity/listings", icon: "utensils", label: t("actions.requests"), count: c.requestsPending },
    { href: "/charity/reports", icon: "heart", label: t("actions.reports"), count: c.reportsToReview },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        crumbs={t("crumbs")}
        title={t("welcome", { charity: charityName[locale] })}
        subtitle={t("scope")}
      />
      <section aria-labelledby="ch-actions">
        <h2 id="ch-actions" className="mb-3 text-h4 text-heading">
          {t("actionsTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {actions.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex h-full items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card hover:border-action"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-selected text-heading">
                  <Icon name={a.icon} size={22} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="tabular text-h4 text-heading">{f.n(a.count)}</span>
                  <span className="text-small text-muted">{a.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label={t("impactTitle")} className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon="pickup"
          value={f.kg(c.deliveredKg)}
          label={t("impact.delivered")}
          source={tc("computedFromDemo")}
        />
        <MetricCard
          icon="charities"
          value={f.kg(c.distributedKg)}
          label={t("impact.distributed")}
          source={t("impact.distributedSource")}
        />
        <MetricCard
          icon="heart"
          value={f.kg(c.rescuedKg)}
          label={t("impact.rescued")}
          source={t("impact.rescuedSource")}
        />
      </section>
    </div>
  );
}

/** "Tasks & team" — events waiting for a representative, active tasks, finished ones, and the team's load. */
export function CharityTasksScreen() {
  const { user, data } = useCharity();
  if (!user || !data) return null;
  return <CharityTasksView data={data} user={user} />;
}

function CharityTasksView({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("charity.tasks");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const { needsAssignment, active, finished } = selectCharityTasks(data, user.organizationId!);
  const team = selectTeam(data, user.organizationId!, new Date().toISOString());
  const card = (task: (typeof active)[number], href: string) => (
    <RecordCard
      href={href}
      title={
        <>
          {task.event.title[locale]} · <bdi>{task.event.id}</bdi>
        </>
      }
      badge={<StatusBadge status={task.event.status} />}
      meta={[
        { icon: "halls", text: f.orgName(task.event.hallId) },
        { icon: "time", text: t("ready", { at: f.dateTime(task.event.foodReadyAt) }) },
        task.assignment
          ? {
              icon: "charities",
              text: t("rep", {
                rep: f.userName(task.assignment.representativeId),
                at: f.time(task.assignment.plannedArrivalAt),
              }),
            }
          : { icon: "charities", text: t("noRep") },
      ]}
    />
  );
  const section = (
    id: string,
    title: string,
    items: typeof active,
    hrefOf: (x: (typeof active)[number]) => string,
    empty: string,
  ) => (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-h4 text-heading">
        {title} <span className="text-muted">({f.n(items.length)})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-small text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((x) => (
            <li key={x.event.id}>{card(x, hrefOf(x))}</li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
        {section(
          "t-needs",
          t("needs"),
          needsAssignment,
          (x) => `/charity/opportunities/${x.event.id}/assign`,
          t("needsEmpty"),
        )}
        {section(
          "t-active",
          t("active"),
          active,
          (x) => (x.event.status === "inspected" ? "/charity/handovers" : `/charity/tasks/${x.event.id}`),
          t("activeEmpty"),
        )}
        {section("t-done", t("finished"), finished, (x) => `/charity/tasks/${x.event.id}`, t("finishedEmpty"))}
      </div>
      <Panel title={t("teamTitle")} titleId="t-team">
        <ul className="flex flex-col gap-3">
          {team.map((m) => (
            <li key={m.user.id} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-b-0">
              <span className="text-small-strong text-heading">{m.user.displayName?.[locale] ?? m.user.id}</span>
              <span className="text-caption text-muted">
                {m.availableUntil
                  ? t("unavailableAfter", { time: m.availableUntil })
                  : t("activeTasks", {
                      count: data.assignments.filter((a) => a.representativeId === m.user.id && a.status === "active")
                        .length,
                    })}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-muted">{t("teamNote")}</p>
      </Panel>
    </div>
  );
}

/** Read-only view of a coordinated event for the charity (same shared panels as the hall). */
export { CharityEventView } from "./CharityEventView";

/** Charity activity log (blueprint matrix: "سجل جمعيته"). */
export function CharityActivityScreen() {
  const t = useTranslations("charity.activity");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const charityId = user.organizationId!;
  const eventIds = new Set(data.coordination.filter((c) => c.charityId === charityId).map((c) => c.eventId));
  const listingIds = new Set(data.listings.filter((l) => l.charityId === charityId).map((l) => l.id));
  const requestIds = new Set(data.requests.filter((r) => listingIds.has(r.listingId)).map((r) => r.id));
  const reportIds = new Set(data.reports.filter((r) => r.charityId === charityId).map((r) => r.id));
  const entries = data.activity
    .filter(
      (a) =>
        (a.entityType === "event" && eventIds.has(a.entityId)) ||
        (a.entityType === "listing" && listingIds.has(a.entityId)) ||
        (a.entityType === "request" && requestIds.has(a.entityId)) ||
        (a.entityType === "report" && reportIds.has(a.entityId)),
    )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
      {entries.length === 0 ? (
        <Card>
          <StateMessage icon="listChecks" title={t("empty")} />
        </Card>
      ) : (
        <Panel title={t("listTitle")} titleId="ch-log">
          <ActivityList data={data} entries={entries} />
        </Panel>
      )}
    </div>
  );
}
