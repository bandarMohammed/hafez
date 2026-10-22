"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { computeForecast } from "@/domain/forecast";
import { distributedKg, selectShield } from "@/domain/selectors/beneficiary";
import { EVENT_STATUSES } from "@/domain/types";
import type { DemoDataset, DemoUser } from "@/domain/types";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityList } from "@/features/common/ActivityList";
import { EventStepper } from "@/features/common/EventStepper";
import { useFormatters } from "@/features/common/useFormatters";
import { TIP_ID } from "@/features/beneficiary/Shield";
import { useUnits } from "@/features/charity/Listings";
import { JOURNEY, JOURNEY_STEPS, canRunJourney, playJourney, remainingSteps, selectJourney } from "./scenario";
import type { JourneyState, JourneyStep } from "./scenario";

/**
 * One page for the pitch: the whole Hafez journey (C → D → E → D → H) plus the platform view (B + F),
 * played live on the same records as the full role screens — which all stay available for questions.
 */
const STEP_META: Record<JourneyStep, { account: string; screens: string; icon: IconKey }> = {
  hall: { account: JOURNEY.hall, screens: "C2 · C3", icon: "halls" },
  charity: { account: JOURNEY.charity, screens: "D2 · D4", icon: "charities" },
  field: { account: JOURNEY.rep, screens: "E2 · E3 · E4", icon: "pickup" },
  publish: { account: JOURNEY.charity, screens: "D5 · D6", icon: "package" },
  beneficiary: { account: JOURNEY.beneficiary, screens: "H2 · H7", icon: "heart" },
  behavior: { account: JOURNEY.beneficiary, screens: "H5 · H6", icon: "shield" },
};

const MANAGER = "demo-admin";
const JUDGES = "demo-judge";

export function JourneyScreen() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const status = useDemoStore((s) => s.status);
  const data = useDemoStore((s) => s.data);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);

  return (
    <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo locale={locale} width={120} priority />
          <span className="rounded-full bg-warning-bg px-3 py-1 text-caption text-warning">
            {t("journey.demoBadge")}
          </span>
        </div>
        <LanguageSwitch />
      </header>

      {status === "error" ? (
        <StateMessage
          asPage
          icon="alert"
          tone="danger"
          title={t("states.error.title")}
          body={t("states.error.body")}
          actions={<Button onClick={resetDemoData}>{t("states.error.reset")}</Button>}
        />
      ) : status === "idle" || !data ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <span className="sr-only">{t("states.loading")}</span>
          <Skeleton className="h-56 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <Journey data={data} />
      )}
    </main>
  );
}

function Journey({ data }: { data: DemoDataset }) {
  const t = useTranslations("journey");
  const tc = useTranslations("common");
  const router = useRouter();
  const current = useCurrentUser();
  const selectUser = useDemoStore((s) => s.selectUser);
  const dispatch = useDemoStore((s) => s.dispatch);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);
  const f = useFormatters(data);
  const [confirmReset, setConfirmReset] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announce, setAnnounce] = useState("");

  // The page is the platform view: the manager by default, or the judges' read-only account.
  const manager = data.users.find((u) => u.id === MANAGER);
  const viewer: DemoUser | undefined =
    current && (current.role === "admin" || current.role === "judge_viewer") ? current : manager;
  const readOnly = !canRunJourney(viewer);
  const state = selectJourney(data, TIP_ID);
  const doneCount = JOURNEY_STEPS.filter((s) => state.done[s]).length;

  const play = (steps: JourneyStep[]) => {
    if (!viewer || steps.length === 0) return;
    if (current?.id !== viewer.id) selectUser(viewer.id);
    const r = dispatch(playJourney(steps, TIP_ID), { flashOn: "/journey" });
    setFailed(!r.ok);
    if (r.ok) setAnnounce(t("announce", { step: t(`steps.${steps[steps.length - 1]}.title`) }));
  };
  const openAs = (accountId: string, path: string) => {
    selectUser(accountId);
    router.push(path);
  };

  // Derived from the shared records — the same numbers the role dashboards compute.
  const receivedKg = data.handovers
    .filter((h) => {
      const e = data.events.find((x) => x.id === h.eventId);
      return e?.status === "collected" || e?.status === "closed";
    })
    .reduce((sum, h) => sum + h.actualQuantity, 0);
  const shield = selectShield(data, JOURNEY.beneficiary);
  // Once the journey starts, the log follows its own records (seed entries are dated later in the demo day).
  const journeyIds = [state.event?.id, state.listing?.id, state.request?.id].filter((x): x is string => Boolean(x));

  return (
    <>
      <section
        aria-labelledby="journey-title"
        className="flex flex-col gap-5 rounded-xl bg-inverse p-6 text-on-inverse lg:flex-row lg:items-end lg:justify-between lg:p-8"
      >
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-caption text-accent-on-inverse">{t("eyebrow")}</p>
          <h1 id="journey-title" className="text-h2 text-on-inverse">
            {t("title")}
          </h1>
          <p className="text-body text-on-inverse/85">{t("subtitle")}</p>
          <div
            role="group"
            aria-label={t("viewerLabel")}
            className="mt-2 inline-flex w-fit flex-wrap gap-1 rounded-full bg-inverse-raised p-1"
          >
            {[
              { id: MANAGER, label: t("viewer.manager") },
              { id: JUDGES, label: t("viewer.judges") },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={viewer?.id === v.id}
                onClick={() => selectUser(v.id)}
                className={cn(
                  "min-h-10 rounded-full px-4 text-small-strong transition-colors",
                  viewer?.id === v.id ? "bg-surface text-heading" : "text-on-inverse hover:bg-inverse",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:min-w-72">
          <p className="text-small text-accent-on-inverse" aria-live="polite">
            {t("progress", { done: doneCount, total: JOURNEY_STEPS.length })}
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-inverse-raised"
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuemin={0}
            aria-valuemax={JOURNEY_STEPS.length}
            aria-valuenow={doneCount}
          >
            <div
              className="h-full rounded-full bg-gold-on-inverse"
              style={{ width: `${(doneCount / JOURNEY_STEPS.length) * 100}%` }}
            />
          </div>
          {!readOnly ? (
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              {state.next ? (
                <>
                  <Button onClick={() => play([state.next!])}>
                    {t("playNext", { step: t(`steps.${state.next}.title`) })}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-on-inverse/40 bg-transparent text-on-inverse hover:bg-inverse-raised hover:text-on-inverse"
                    onClick={() => play(remainingSteps(state))}
                  >
                    {t("playAll")}
                  </Button>
                </>
              ) : (
                <p className="rounded-md bg-inverse-raised px-4 py-3 text-small text-on-inverse">{t("complete")}</p>
              )}
              <Button
                variant="ghost"
                className="text-accent-on-inverse hover:bg-inverse-raised hover:text-on-inverse"
                onClick={() => setConfirmReset(true)}
              >
                <Icon name="reset" size={18} />
                {t("reset")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {failed ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-4 py-3 text-small text-danger">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          {t("failed")}
        </p>
      ) : null}
      {confirmReset && !readOnly ? (
        <div
          role="alertdialog"
          aria-labelledby="reset-title"
          aria-describedby="reset-body"
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-raised"
        >
          <h2 id="reset-title" className="text-h4 text-heading">
            {t("resetTitle")}
          </h2>
          <p id="reset-body" className="text-small text-muted">
            {t("resetBody")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              onClick={() => {
                resetDemoData();
                setConfirmReset(false);
                setFailed(false);
              }}
            >
              {t("resetConfirm")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {readOnly ? <Notice tone="info">{t("judgesNotice")}</Notice> : null}

      <section aria-labelledby="impact-title" className="flex flex-col gap-3">
        <h2 id="impact-title" className="text-h4 text-heading">
          {t("impactTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon="events"
            value={f.n(data.events.length)}
            label={t("metrics.events")}
            source={tc("computedFromDemo")}
          />
          <MetricCard
            icon="weight"
            value={f.kg(receivedKg)}
            label={t("metrics.received")}
            source={tc("computedFromDemo")}
          />
          <MetricCard
            icon="heart"
            value={f.kg(distributedKg(data))}
            label={t("metrics.distributed")}
            source={tc("computedFromDemo")}
          />
          <MetricCard
            icon="shield"
            value={f.n(shield.balance)}
            label={t("metrics.points")}
            source={tc("computedFromDemo")}
          />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="flex flex-col gap-3">
        <h2 id="steps-title" className="text-h4 text-heading">
          {t("stepsTitle")}
        </h2>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {JOURNEY_STEPS.map((step, i) => (
            <li key={step}>
              <StepCard
                data={data}
                state={state}
                step={step}
                index={i}
                readOnly={readOnly}
                onPlay={() => play([step])}
                onOpen={openAs}
              />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="platform-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="platform-title" className="text-h4 text-heading">
            {t("platformTitle")}
          </h2>
          <p className="text-small text-muted">{t("platformSubtitle")}</p>
        </div>
        {state.event ? <EventStepper status={state.event.status} /> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <StatusBreakdown data={data} />
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
            <h3 className="text-body-strong text-heading">
              {journeyIds.length ? t("activityJourney") : readOnly ? t("activitySummary") : t("activityFull")}
            </h3>
            <ActivityList
              data={data}
              entries={[...data.activity]
                .filter((a) => journeyIds.length === 0 || journeyIds.includes(a.entityId))
                .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
                .slice(0, readOnly ? 4 : 6)}
            />
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-start gap-3 rounded-lg bg-surface-alt p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink">{t("fullScreensHint")}</p>
        <ButtonLink href="/" variant="secondary">
          {t("fullScreens")}
        </ButtonLink>
      </footer>
    </>
  );
}

function StepCard({
  data,
  state,
  step,
  index,
  readOnly,
  onPlay,
  onOpen,
}: {
  data: DemoDataset;
  state: JourneyState;
  step: JourneyStep;
  index: number;
  readOnly: boolean;
  onPlay: () => void;
  onOpen: (accountId: string, path: string) => void;
}) {
  const t = useTranslations("journey");
  const tr = useTranslations("roles");
  const trs = useTranslations("requestStatus");
  const tsh = useTranslations("beneficiary.shield.levels");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const units = useUnits();
  const meta = STEP_META[step];
  const actor = data.users.find((u) => u.id === meta.account);
  const done = state.done[step];
  const isNext = state.next === step;
  const { event, assignment, handover, listing, request } = state;

  const results: string[] = [];
  let openPath: string | null = null;
  if (done && event) {
    switch (step) {
      case "hall":
        results.push(
          t("results.hall", {
            event: event.id,
            planned: f.kg(event.forecast?.plannedKgBefore ?? event.plannedQuantityKg ?? 0),
            recommended: f.kg(event.plannedQuantityKg ?? 0),
          }),
          t("results.hallSurplus", { surplus: f.kg(event.expectedSurplusKg ?? 0) }),
        );
        openPath = `/hall/events/${event.id}`;
        break;
      case "charity":
        results.push(
          t("results.charity", {
            charity: f.orgName(assignment?.charityId),
            rep: f.userName(assignment?.representativeId),
          }),
        );
        openPath = `/charity/tasks/${event.id}`;
        break;
      case "field": {
        const inspection = data.inspections.find((x) => x.eventId === event.id && x.status === "final");
        results.push(
          t("results.fieldInspection", { estimate: f.kg(inspection?.estimatedQuantity ?? 0) }),
          t("results.fieldHandover", { actual: f.kg(handover?.actualQuantity ?? 0) }),
        );
        openPath = `/field/tasks/${event.id}`;
        break;
      }
      case "publish":
        if (listing) {
          results.push(
            t("results.collected", { actual: f.kg(handover?.actualQuantity ?? 0) }),
            t("results.listing", {
              units: units(listing.totalUnits, listing.unitLabel),
              kg: f.n(listing.unitKg),
              area: listing.area[locale],
            }),
          );
          openPath = `/charity/listings/${listing.id}`;
        }
        break;
      case "beneficiary":
        if (request && listing) {
          results.push(
            t("results.request", {
              units: units(request.units, listing.unitLabel),
              kg: f.kg(request.units * listing.unitKg),
              status: trs(request.status),
            }),
            t("results.points", { n: f.n(DEMO_CONFIG.points.requestConfirmed) }),
          );
          openPath = "/beneficiary/requests";
        }
        break;
      case "behavior": {
        const shield = selectShield(data, JOURNEY.beneficiary);
        results.push(t("results.behavior", { level: tsh(shield.level), balance: f.n(shield.balance) }));
        openPath = "/beneficiary/shield";
        break;
      }
    }
  }

  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border bg-surface p-5 shadow-card",
        done ? "border-success/40" : isNext ? "border-[1.5px] border-action" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-small-strong",
            done ? "bg-success-bg text-success" : isNext ? "bg-action text-on-action" : "bg-surface-alt text-muted",
          )}
        >
          {done ? <Icon name="check" size={18} /> : index + 1}
          <span className="sr-only">{done ? t("stateDone") : isNext ? t("stateNext") : t("stateUpcoming")}</span>
        </span>
        <span className="rounded-full bg-surface-alt px-3 py-1 text-caption text-muted" dir="ltr">
          {meta.screens}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Avatar initials={actor?.initials[locale] ?? "?"} size={32} />
        <span className="flex items-center gap-1.5 text-small-strong text-heading">
          <Icon name={meta.icon} size={18} />
          {actor ? tr(`${actor.role}.name`) : "—"}
        </span>
      </div>
      <h3 className="text-body-strong text-heading">{t(`steps.${step}.title`)}</h3>
      <p className="text-small text-muted">
        {step === "hall"
          ? t("steps.hall.body", {
              guests: f.n(JOURNEY.guests),
              planned: f.kg(JOURNEY.plannedKg),
              recommended: f.kg(
                computeForecast({ guests: JOURNEY.guests, plannedKg: JOURNEY.plannedKg }).recommendedKg,
              ),
            })
          : t(`steps.${step}.body`)}
      </p>
      {results.length ? (
        <ul className="flex flex-col gap-1 rounded-md bg-selected px-3 py-2">
          {results.map((r) => (
            <li key={r} className="text-caption text-heading">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
      {event && step === "hall" && done ? <StatusBadge status={event.status} className="w-fit" /> : null}
      <div className="mt-auto flex flex-col gap-2 pt-1">
        {isNext && !readOnly ? <Button onClick={onPlay}>{t("play")}</Button> : null}
        {done && openPath ? (
          <Button variant="ghost" className="w-full justify-center" onClick={() => onOpen(meta.account, openPath!)}>
            {t("open", { role: actor ? tr(`${actor.role}.name`) : "" })}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/** B4 / F1 — events by status across the platform, from the same records. */
function StatusBreakdown({ data }: { data: DemoDataset }) {
  const t = useTranslations("journey");
  const f = useFormatters(data);
  const rows = EVENT_STATUSES.map((s) => ({
    status: s,
    count: data.events.filter((e) => e.status === s).length,
  })).filter((r) => r.count > 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
      <h3 className="text-body-strong text-heading">{t("byStatus")}</h3>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.status} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3">
            <StatusBadge status={r.status} className="justify-self-start" />
            <span className="h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
              <span className="block h-full rounded-full bg-action" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="text-end text-small-strong text-heading">{f.n(r.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
