"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { computeForecast } from "@/domain/forecast";
import { selectShield } from "@/domain/selectors/beneficiary";
import { EVENT_STATUSES } from "@/domain/types";
import type { DemoDataset } from "@/domain/types";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityList } from "@/features/common/ActivityList";
import { EventStepper } from "@/features/common/EventStepper";
import { useFormatters } from "@/features/common/useFormatters";
import { TIP_ID } from "@/features/beneficiary/Shield";
import { useUnits } from "@/features/charity/Listings";
import { ImpactDashboard } from "./ImpactDashboard";
import { JOURNEY, JOURNEY_STEPS, manualStepLink, playJourney, remainingSteps, selectJourney } from "./scenario";
import { clearCameFromJourney, markCameFromJourney } from "./returnToJourney";
import type { JourneyState, JourneyStep } from "./scenario";

/**
 * One page for the pitch, run by the platform manager: the whole Hafez journey (C → D → E → D → H),
 * a live impact dashboard and platform tracking — on the same records as the full role screens.
 */
const STEP_META: Record<JourneyStep, { account: string; screens: string; icon: IconKey }> = {
  hall: { account: JOURNEY.hall, screens: "C2 · C3", icon: "halls" },
  charity: { account: JOURNEY.charity, screens: "D2 · D4", icon: "charities" },
  field: { account: JOURNEY.rep, screens: "E2 · E3 · E4", icon: "pickup" },
  publish: { account: JOURNEY.charity, screens: "D5 · D6", icon: "package" },
  beneficiary: { account: JOURNEY.beneficiary, screens: "H2 · H7", icon: "heart" },
  behavior: { account: JOURNEY.beneficiary, screens: "H5 · H6", icon: "shield" },
};

/** Buttons on the dark hero (the shared variants assume a light surface). */
const HERO_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-button transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-inverse";
const HERO_OUTLINE = `${HERO_BASE} border-[1.5px] border-on-inverse/50 text-on-inverse hover:bg-inverse-raised`;
const HERO_GHOST = `${HERO_BASE} text-accent-on-inverse hover:bg-inverse-raised hover:text-on-inverse`;

/** The page always acts as the platform manager (the only account allowed to play and reset the demo). */
const MANAGER = "demo-admin";

export function JourneyScreen() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const status = useDemoStore((s) => s.status);
  const data = useDemoStore((s) => s.data);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);

  return (
    <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-40 rounded-lg" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
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
  const router = useRouter();
  const current = useCurrentUser();
  const selectUser = useDemoStore((s) => s.selectUser);
  const dispatch = useDemoStore((s) => s.dispatch);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);
  const [confirmReset, setConfirmReset] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [selected, setSelected] = useState<JourneyStep | null>(null);
  // Back on the journey: the role screens no longer need the "back" button.
  useEffect(() => clearCameFromJourney(), []);

  const state = selectJourney(data, TIP_ID);
  const doneCount = JOURNEY_STEPS.filter((s) => state.done[s]).length;
  const lastDone = [...JOURNEY_STEPS].reverse().find((s) => state.done[s]);
  const shown: JourneyStep = selected ?? state.next ?? lastDone ?? "hall";

  const play = (steps: JourneyStep[]) => {
    if (steps.length === 0) return;
    if (current?.id !== MANAGER) selectUser(MANAGER);
    const r = dispatch(playJourney(steps, TIP_ID), { flashOn: "/journey" });
    setFailed(!r.ok);
    if (r.ok) {
      const last = steps[steps.length - 1]!;
      setSelected(last);
      setAnnounce(t("announce", { step: t(`steps.${last}.title`) }));
    }
  };
  const openAs = (accountId: string, path: string) => {
    markCameFromJourney();
    selectUser(accountId);
    router.push(path);
  };
  const reset = () => {
    resetDemoData();
    setConfirmReset(false);
    setFailed(false);
    setSelected(null);
  };

  return (
    <>
      {/* Hero: what the page shows + the presenter's controls. */}
      <section
        aria-labelledby="journey-title"
        className="-mt-4 flex flex-col gap-6 rounded-xl bg-inverse p-6 text-on-inverse lg:flex-row lg:items-center lg:justify-between lg:p-8"
      >
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-caption text-accent-on-inverse">{t("eyebrow")}</p>
          <h1 id="journey-title" className="text-h2 text-on-inverse">
            {t("title")}
          </h1>
          <p className="text-body text-on-inverse/85">{t("subtitle")}</p>
          <nav aria-label={t("sectionsLabel")} className="mt-1 flex flex-wrap gap-2">
            {(["journey", "impact", "platform"] as const).map((k, i) => (
              <a
                key={k}
                href={`#${k}`}
                className="rounded-full bg-inverse-raised px-3 py-1.5 text-small-strong text-on-inverse hover:bg-surface hover:text-heading"
              >
                {i + 1}. {t(`sections.${k}`)}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 lg:w-80">
          <div className="flex items-center justify-between gap-2 text-small text-accent-on-inverse">
            <span>{t("managerLabel")}</span>
            <span aria-live="polite">{t("progress", { done: doneCount, total: JOURNEY_STEPS.length })}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-inverse-raised"
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuemin={0}
            aria-valuemax={JOURNEY_STEPS.length}
            aria-valuenow={doneCount}
          >
            <div
              className="h-full rounded-full bg-gold-on-inverse transition-[width] duration-500"
              style={{ width: `${(doneCount / JOURNEY_STEPS.length) * 100}%` }}
            />
          </div>
          {state.next ? (
            <>
              <Button onClick={() => play([state.next!])}>
                {t("playNext", { step: t(`steps.${state.next}.short`) })}
              </Button>
              <button type="button" onClick={() => play(remainingSteps(state))} className={HERO_OUTLINE}>
                {t("playAll")}
              </button>
            </>
          ) : (
            <p className="rounded-md bg-inverse-raised px-4 py-3 text-small text-on-inverse">{t("complete")}</p>
          )}
          <button type="button" onClick={() => setConfirmReset(true)} className={HERO_GHOST}>
            <Icon name="reset" size={18} />
            {t("reset")}
          </button>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {failed ? (
        <p
          role="alert"
          className="-mt-6 flex items-start gap-2 rounded-md bg-danger-bg px-4 py-3 text-small text-danger"
        >
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          {t("failed")}
        </p>
      ) : null}
      {confirmReset ? (
        <div
          role="alertdialog"
          aria-labelledby="reset-title"
          aria-describedby="reset-body"
          className="-mt-6 flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-raised"
        >
          <h2 id="reset-title" className="text-h4 text-heading">
            {t("resetTitle")}
          </h2>
          <p id="reset-body" className="text-small text-muted">
            {t("resetBody")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="danger" onClick={reset}>
              {t("resetConfirm")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <Section id="journey" number={1} title={t("sections.journey")} subtitle={t("journeySubtitle")}>
        <Tracker state={state} shown={shown} onSelect={setSelected} />
        <StepDetail data={data} state={state} step={shown} onPlay={() => play([shown])} onOpen={openAs} />
      </Section>

      <Section id="impact" number={2} title={t("sections.impact")} subtitle={t("impactSubtitle")}>
        <ImpactDashboard data={data} />
      </Section>

      <Section id="platform" number={3} title={t("sections.platform")} subtitle={t("platformSubtitle")}>
        {state.event ? <EventStepper status={state.event.status} /> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <StatusBreakdown data={data} />
          <JourneyActivity data={data} state={state} />
        </div>
      </Section>

      <footer className="flex flex-col items-start gap-3 rounded-lg bg-surface-alt p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink">{t("fullScreensHint")}</p>
        <ButtonLink href="/" variant="secondary">
          {t("fullScreens")}
        </ButtonLink>
      </footer>
    </>
  );
}

function Section({
  id,
  number,
  title,
  subtitle,
  children,
}: {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex items-start gap-3 border-b border-line pb-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-inverse text-small-strong text-on-inverse">
          {number}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-h3 text-heading">
            {title}
          </h2>
          <p className="text-small text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Progress tracker: six steps in order; each one can be selected to see its details. */
function Tracker({
  state,
  shown,
  onSelect,
}: {
  state: JourneyState;
  shown: JourneyStep;
  onSelect: (s: JourneyStep) => void;
}) {
  const t = useTranslations("journey");
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label={t("trackerLabel")}>
      {JOURNEY_STEPS.map((step, i) => {
        const done = state.done[step];
        const isNext = state.next === step;
        const active = shown === step;
        return (
          <li key={step} className="relative flex flex-col items-center">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[1.375rem] hidden h-0.5 w-full sm:block ltr:right-1/2 rtl:left-1/2",
                  done || isNext ? "bg-action" : "bg-line",
                )}
              />
            ) : null}
            <button
              type="button"
              aria-pressed={active}
              aria-label={`${i + 1}. ${t(`steps.${step}.title`)} — ${
                done ? t("stateDone") : isNext ? t("stateNext") : t("stateUpcoming")
              }`}
              onClick={() => onSelect(step)}
              className="group relative z-10 flex flex-col items-center gap-2 rounded-md px-1 py-1 text-center"
            >
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full border-2 text-small-strong transition-colors",
                  done
                    ? "border-action bg-action text-on-action"
                    : isNext
                      ? "border-action bg-surface text-action"
                      : "border-line bg-surface text-muted",
                  active && "ring-4 ring-selected",
                )}
              >
                {done ? <Icon name="check" size={20} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-caption group-hover:text-heading",
                  active ? "font-semibold text-heading" : done ? "text-ink" : "text-muted",
                )}
              >
                {t(`steps.${step}.short`)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepDetail({
  data,
  state,
  step,
  onPlay,
  onOpen,
}: {
  data: DemoDataset;
  state: JourneyState;
  step: JourneyStep;
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
  const roleName = actor ? tr(`${actor.role}.name`) : "—";
  const done = state.done[step];
  const isNext = state.next === step;
  const { event, assignment, handover, listing, request } = state;
  const index = JOURNEY_STEPS.indexOf(step);
  const nextIndex = state.next ? JOURNEY_STEPS.indexOf(state.next) : -1;
  const leadsToNext = done && nextIndex === index + 1;
  const manual = isNext || leadsToNext ? manualStepLink(state) : null;
  const manualActor = manual && data.users.find((u) => u.id === manual.account);
  const manualRole = manualActor ? tr(`${manualActor.role}.name`) : roleName;

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
      aria-labelledby="step-title"
      className={cn(
        "grid gap-5 rounded-lg border bg-surface p-5 shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:p-6",
        isNext ? "border-[1.5px] border-action" : "border-line",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted">{t("stepOf", { n: index + 1, total: JOURNEY_STEPS.length })}</span>
          <span className="rounded-full bg-surface-alt px-2.5 py-0.5 text-caption text-muted" dir="ltr">
            {meta.screens}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-caption",
              done ? "bg-success-bg text-success" : isNext ? "bg-selected text-heading" : "bg-surface-alt text-muted",
            )}
          >
            {done ? t("stateDone") : isNext ? t("stateNext") : t("stateUpcoming")}
          </span>
        </div>
        <h3 id="step-title" className="text-h4 text-heading">
          {t(`steps.${step}.title`)}
        </h3>
        <div className="flex items-center gap-2">
          <Avatar initials={actor?.initials[locale] ?? "?"} size={32} />
          <span className="flex items-center gap-1.5 text-small-strong text-heading">
            <Icon name={meta.icon} size={18} />
            {roleName}
          </span>
        </div>
        <p className="text-body text-ink">
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
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-1 flex-col gap-2 rounded-md bg-surface-alt p-4">
          <h4 className="text-small-strong text-heading">{t("resultTitle")}</h4>
          {results.length ? (
            <ul className="flex flex-col gap-1.5">
              {results.map((r) => (
                <li key={r} className="flex items-start gap-2 text-small text-ink">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">{isNext ? t("resultPending") : t("resultLater")}</p>
          )}
          {event && step === "hall" && done ? <StatusBadge status={event.status} className="w-fit" /> : null}
        </div>
        {isNext ? <Button onClick={onPlay}>{t("play")}</Button> : null}
        {isNext && manual ? (
          <>
            <Button variant="secondary" onClick={() => onOpen(manual.account, manual.path)}>
              {t("open", { role: manualRole })}
            </Button>
            <p className="text-caption text-muted">{t("manualHint")}</p>
          </>
        ) : null}
        {leadsToNext && manual ? (
          <Button onClick={() => onOpen(manual.account, manual.path)}>{t("openNext", { role: manualRole })}</Button>
        ) : null}
        {done && openPath ? (
          <Button variant="secondary" onClick={() => onOpen(meta.account, openPath!)}>
            {t("open", { role: roleName })}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/** Events by status across the platform, from the same records. */
function StatusBreakdown({ data }: { data: DemoDataset }) {
  const t = useTranslations("journey");
  const f = useFormatters(data);
  const rows = EVENT_STATUSES.map((s) => ({
    status: s,
    count: data.events.filter((e) => e.status === s).length,
  })).filter((r) => r.count > 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
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

/** The journey's own trail once it starts (seed entries are dated later in the demo day); latest entries before. */
function JourneyActivity({ data, state }: { data: DemoDataset; state: JourneyState }) {
  const t = useTranslations("journey");
  const ids = [state.event?.id, state.listing?.id, state.request?.id].filter((x): x is string => Boolean(x));
  const entries = [...data.activity]
    .filter((a) => ids.length === 0 || ids.includes(a.entityId))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 6);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="text-body-strong text-heading">{ids.length ? t("activityJourney") : t("activityFull")}</h3>
      <ActivityList data={data} entries={entries} />
    </div>
  );
}
