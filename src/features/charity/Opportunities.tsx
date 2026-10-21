"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { can, eventRelations } from "@/domain/permissions";
import { publishedAt, selectOpportunities } from "@/domain/selectors/charity";
import { DECLINE_REASONS } from "@/domain/types";
import type { DeclineReason, DemoDataset, DemoUser, HallEvent } from "@/domain/types";
import { declineOpportunity, expressInterest } from "@/domain/workflow/charity";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterChips, RadioCards } from "@/components/ui/Choice";
import { DetailList } from "@/components/ui/DetailList";
import { Field, TextArea, describedBy } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useFormatters } from "@/features/common/useFormatters";

export function useCharity() {
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const charity = data?.organizations.find((o) => o.id === user?.organizationId);
  return { user, data, charity };
}

const riyadhDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/** Event line used by D1 cards and headers: hall · district, city. */
function useHallLine(data: DemoDataset) {
  const locale = useLocale() as Locale;
  return (e: HallEvent) => {
    const h = data.organizations.find((o) => o.id === e.hallId);
    return `${h?.name[locale] ?? ""} · ${[h?.district?.[locale], h?.city[locale]].filter(Boolean).join("، ")}`;
  };
}

/* ================================================================ D1 */

/** Figma D1 — published opportunities in range (registered, unpublished events never appear). */
export function OpportunitiesScreen() {
  const { user, data, charity } = useCharity();
  if (!user || !data || !charity) return null;
  return <OpportunitiesList user={user} data={data} charityName={charity.name} />;
}

function OpportunitiesList({
  user,
  data,
  charityName,
}: {
  user: DemoUser;
  data: DemoDataset;
  charityName: { ar: string; en: string };
}) {
  const t = useTranslations("charity.opportunities");
  const [filter, setFilter] = useState<"all" | "today" | "interested">("all");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const hallLine = useHallLine(data);
  const all = selectOpportunities(data, user);
  const today = riyadhDay(new Date().toISOString());
  const interested = all.filter((e) => e.status === "awaiting_charity");
  const isToday = (e: HallEvent) => riyadhDay(e.foodReadyAt) === today;
  const shown = filter === "today" ? all.filter(isToday) : filter === "interested" ? interested : all;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle", { charity: charityName[locale] })} />
      <FilterChips
        label={t("filterLabel")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("all", { count: all.length }) },
          { value: "today", label: t("today", { count: all.filter(isToday).length }) },
          { value: "interested", label: t("interested", { count: interested.length }) },
        ]}
      />
      {shown.length === 0 ? (
        <Card>
          <StateMessage icon="package" title={t("emptyTitle")} body={t("emptyBody")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((e) => (
            <li key={e.id}>
              <RecordCard
                href={
                  e.status === "awaiting_charity"
                    ? `/charity/opportunities/${e.id}/assign`
                    : `/charity/opportunities/${e.id}`
                }
                title={
                  <>
                    {e.title[locale]} · <bdi>{e.id}</bdi>
                  </>
                }
                badge={<StatusBadge status={e.status} />}
                meta={[
                  { icon: "halls", text: hallLine(e) },
                  { icon: "time", text: t("dateReady", { date: f.date(e.eventDate), time: f.time(e.foodReadyAt) }) },
                  e.status === "awaiting_charity"
                    ? { icon: "weight", text: t("interestedNext") }
                    : {
                        icon: "weight",
                        text:
                          e.expectedSurplusKg === null
                            ? t("noEstimate")
                            : t("estimate", { qty: f.kg(e.expectedSurplusKg) }),
                      },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      <Notice tone="info">{t("estimatesNote")}</Notice>
    </div>
  );
}

/* ================================================================ D2 */

/** Figma D2 — coordination details only (time, text location, food type, estimate). */
export function OpportunityDetail({ eventId }: { eventId: string }) {
  const t = useTranslations("charity.detail");
  const tNF = useTranslations("states.notFound");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const event = data.events.find((e) => e.id === eventId);
  const rel = event ? eventRelations(data, event, user) : {};
  if (!event || !can(user, "event.view", { kind: "event", event, rel })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={tNF("title")}
        body={t("goneBody")}
        actions={<ButtonLink href="/charity/opportunities">{t("back")}</ButtonLink>}
      />
    );
  }
  return <OpportunityDetailView data={data} user={user} event={event} />;
}

function OpportunityDetailView({ data, user, event }: { data: DemoDataset; user: DemoUser; event: HallEvent }) {
  const t = useTranslations("charity.detail");
  const tf = useTranslations("newEvent.foodTypes");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const hallLine = useHallLine(data);
  const rel = eventRelations(data, event, user);
  const canInterest = can(user, "coordination.express", { kind: "event", event, rel });
  const canDecline = can(user, "coordination.decline", { kind: "event", event, rel });

  const onInterest = () => {
    const r = dispatch((c) => expressInterest(c, event.id), { flashOn: `/charity/opportunities/${event.id}/assign` });
    if (r.ok) router.push(`/charity/opportunities/${event.id}/assign`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/opportunities", label: t("back") }}
        title={event.title[locale]}
        badge={<StatusBadge status={event.status} />}
        subtitle={
          <>
            <bdi>{event.id}</bdi> · {t("published", { at: f.shortDateTime(publishedAt(data, event)) })}
          </>
        }
      />
      <Card className="p-5">
        <DetailList
          items={[
            { label: t("hall"), value: hallLine(event) },
            {
              label: t("eventTime"),
              value: event.endsAt
                ? t("endsAt", { date: f.date(event.eventDate), time: f.time(event.endsAt) })
                : f.date(event.eventDate),
            },
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
            { label: t("guests"), value: f.n(event.expectedGuests) },
          ]}
        />
      </Card>
      <Notice tone="info">{t("guestsNote")}</Notice>
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        {canInterest ? <Button onClick={onInterest}>{t("interest")}</Button> : null}
        {rel.coordination?.status === "interested" ? (
          <ButtonLink href={`/charity/opportunities/${event.id}/assign`}>{t("goAssign")}</ButtonLink>
        ) : null}
        {canDecline ? (
          <ButtonLink href={`/charity/opportunities/${event.id}/decline`} variant="secondary">
            {t("decline")}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}

/* ================================================================ D3 */

/** Figma D3 — decline with an optional reason; the event is not deleted. */
export function DeclineScreen({ eventId }: { eventId: string }) {
  const t = useTranslations("charity.decline");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const event = data.events.find((e) => e.id === eventId);
  if (!event || !can(user, "coordination.decline", { kind: "event", event, rel: eventRelations(data, event, user) })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("unavailable")}
        actions={<ButtonLink href="/charity/opportunities">{t("backToList")}</ButtonLink>}
      />
    );
  }
  return <DeclineForm event={event} />;
}

function DeclineForm({ event }: { event: HallEvent }) {
  const t = useTranslations("charity.decline");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const r = dispatch((c) => declineOpportunity(c, event.id, { reason, note: note || null }), {
      flashOn: "/charity/opportunities",
    });
    if (r.ok) router.push("/charity/opportunities");
    else if (r.error === "validation") setError(t("noteRequired"));
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: `/charity/opportunities/${event.id}`, label: event.title[locale] }}
        title={t("title", { event: event.id })}
        subtitle={t("subtitle")}
      />
      <Card className="flex flex-col gap-5 p-5">
        <RadioCards
          name="decline-reason"
          legend={t("reasonLegend")}
          value={reason}
          onChange={(v) => {
            setReason(v);
            setError(null);
          }}
          options={DECLINE_REASONS.map((r) => ({
            value: r,
            title: t(`reasons.${r}`, {
              time: new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Riyadh",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(new Date(event.foodReadyAt)),
            }),
          }))}
        />
        <Field id="decline-note" label={t("noteLabel")} required={reason === "other"} error={error ?? undefined}>
          <TextArea
            id="decline-note"
            value={note}
            invalid={Boolean(error)}
            aria-describedby={describedBy("decline-note", { error: error ?? undefined })}
            placeholder={t("notePlaceholder")}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
          />
        </Field>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button variant="danger" onClick={submit}>
          {t("confirm")}
        </Button>
        <ButtonLink href={`/charity/opportunities/${event.id}`} variant="ghost">
          {t("back")}
        </ButtonLink>
      </div>
    </div>
  );
}
