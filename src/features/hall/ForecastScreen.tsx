"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { DEFAULT_ASSUMPTIONS, computeForecast, forecastAvailability } from "@/domain/forecast";
import type { ForecastAssumptions, ForecastDecision } from "@/domain/forecast";
import { normalizeDigits } from "@/domain/newEvent";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, describedBy } from "@/components/ui/Field";
import { MetricCard } from "@/components/ui/MetricCard";
import { StateMessage } from "@/components/ui/StateMessage";

const cfg = DEMO_CONFIG.forecast;

/** Accepts "0.5", "0,5", "٠٫٥" → 0.5. Returns null when not a plain decimal number. */
function parseDecimal(raw: string): number | null {
  const v = normalizeDigits(raw).trim().replace(/[٫,]/g, ".");
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}

/** Figma C3 — surplus forecast & recommendation before publishing (frames 49:5891 AR / 49:6078 EN). */
export function ForecastScreen({ eventId }: { eventId: string }) {
  const t = useTranslations("forecast");
  const tc = useTranslations("common");
  const tStates = useTranslations("states");
  const tStatus = useTranslations("status");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const user = useCurrentUser();
  const event = useDemoStore((s) => s.data?.events.find((e) => e.id === eventId));
  const decideForecast = useDemoStore((s) => s.decideForecast);

  const [assumptions, setAssumptions] = useState<ForecastAssumptions>(DEFAULT_ASSUMPTIONS);
  const [kgDraft, setKgDraft] = useState(String(DEFAULT_ASSUMPTIONS.kgPerGuest));
  const [marginDraft, setMarginDraft] = useState(String(Math.round(DEFAULT_ASSUMPTIONS.safetyMargin * 100)));
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const adjustId = useId();

  // After a decision the event is no longer "registered"; keep the screen blank while navigating away.
  if (deciding) return null;

  const availability = forecastAvailability(user, event);
  if (availability !== "ok" || !event?.plannedQuantityKg) {
    const back = <ButtonLink href="/hall">{t("unavailable.back")}</ButtonLink>;
    if (availability === "notFound" || !event)
      return (
        <StateMessage
          asPage
          icon="alert"
          title={tStates("notFound.title")}
          body={tStates("notFound.body")}
          actions={back}
        />
      );
    const [title, body] =
      availability === "alreadyDecided"
        ? [t("unavailable.alreadyDecided"), t("unavailable.alreadyDecidedBody", { status: tStatus(event.status) })]
        : availability === "notAllowed"
          ? [t("unavailable.notAllowed"), t("unavailable.notAllowedBody")]
          : [t("unavailable.noPlannedQuantity"), t("unavailable.noPlannedQuantityBody")];
    return <StateMessage asPage icon="info" tone="info" title={title} body={body} actions={back} />;
  }

  const n = (v: number) => formatNumber(v, locale);
  const kg = (v: number) => tc("kg", { value: n(v) });
  const r = computeForecast({ guests: event.expectedGuests, plannedKg: event.plannedQuantityKg }, assumptions);
  const marginPct = Math.round(assumptions.safetyMargin * 100);
  const capped = r.recommendedKg < Math.ceil(Number((r.consumptionKg * (1 + assumptions.safetyMargin)).toFixed(6)));

  // Draft validation for "Adjust assumptions": only valid values are applied to the calculation.
  const kgValue = parseDecimal(kgDraft);
  const kgError =
    kgValue === null || kgValue < cfg.kgPerGuestRange.min || kgValue > cfg.kgPerGuestRange.max
      ? t("assumptions.kgPerGuestError", { min: n(cfg.kgPerGuestRange.min), max: n(cfg.kgPerGuestRange.max) })
      : undefined;
  const marginValue = parseDecimal(marginDraft);
  const marginError =
    marginValue === null || marginValue < cfg.marginPercentRange.min || marginValue > cfg.marginPercentRange.max
      ? t("assumptions.marginError", { min: n(cfg.marginPercentRange.min), max: n(cfg.marginPercentRange.max) })
      : undefined;
  const draftsInvalid = Boolean(kgError || marginError);

  const onKgChange = (raw: string) => {
    setKgDraft(raw);
    const v = parseDecimal(raw);
    if (v !== null && v >= cfg.kgPerGuestRange.min && v <= cfg.kgPerGuestRange.max)
      setAssumptions((a) => ({ ...a, kgPerGuest: v }));
  };
  const onMarginChange = (raw: string) => {
    setMarginDraft(raw);
    const v = parseDecimal(raw);
    if (v !== null && v >= cfg.marginPercentRange.min && v <= cfg.marginPercentRange.max)
      setAssumptions((a) => ({ ...a, safetyMargin: v / 100 }));
  };
  const resetAssumptions = () => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setKgDraft(String(DEFAULT_ASSUMPTIONS.kgPerGuest));
    setMarginDraft(String(Math.round(DEFAULT_ASSUMPTIONS.safetyMargin * 100)));
  };

  const decide = (decision: ForecastDecision) => {
    if (draftsInvalid) return;
    setDeciding(true);
    if (decideForecast(event.id, decision, assumptions)) router.push("/hall");
    else setDeciding(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-caption text-muted">{t("crumbs")}</p>
        <h1 className="text-h2 text-heading">{t("title", { event: event.id })}</h1>
        <p className="text-small text-muted">{t("subtitle")}</p>
      </header>

      <section aria-label={t("how.title")} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="heart" value={n(r.guests)} label={t("cards.guests")} source={t("cards.hallInput")} />
        <MetricCard icon="utensils" value={kg(r.plannedKg)} label={t("cards.planned")} source={t("cards.hallInput")} />
        <MetricCard
          icon="weight"
          value={kg(r.recommendedKg)}
          label={t("cards.recommended")}
          source={t("cards.ruleResult")}
        />
        <MetricCard
          icon="package"
          value={kg(r.surplusAfterKg)}
          label={t("cards.surplus", { boxes: r.fullBoxes, boxKg: n(cfg.boxKg) })}
          source={t("cards.estimate")}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="fc-how" className="rounded-lg border border-line bg-surface p-6">
          <h2 id="fc-how" className="mb-4 text-h4 text-heading">
            {t("how.title")}
          </h2>
          <ol className="flex flex-col gap-3">
            <CalcRow
              title={t("how.step1")}
              calc={t("how.step1Calc", { guests: r.guests, kgPerGuest: n(assumptions.kgPerGuest) })}
              value={kg(r.consumptionKg)}
            />
            <CalcRow
              highlight
              title={t("how.step2")}
              calc={t(capped ? "how.step2Capped" : "how.step2Calc", {
                consumption: n(r.consumptionKg),
                factor: n(1 + assumptions.safetyMargin),
                margin: n(marginPct),
                planned: n(r.plannedKg),
              })}
              value={kg(r.recommendedKg)}
            />
            <CalcRow
              title={t("how.step3")}
              calc={t("how.step3Calc", { planned: n(r.plannedKg), recommended: n(r.recommendedKg) })}
              value={kg(r.reductionKg)}
            />
            <CalcRow
              title={t("how.step4")}
              calc={t("how.step4Calc", {
                recommended: n(r.recommendedKg),
                consumption: n(r.consumptionKg),
                surplus: n(r.surplusAfterKg),
                boxes: r.fullBoxes,
                boxKg: n(cfg.boxKg),
              })}
              value={kg(r.surplusAfterKg)}
            />
            <CalcRow
              title={t("how.baseline")}
              calc={t("how.baselineCalc", {
                planned: n(r.plannedKg),
                consumption: n(r.consumptionKg),
                baseline: n(r.baselineSurplusKg),
              })}
              value={kg(r.baselineSurplusKg)}
            />
          </ol>
        </section>

        <aside aria-labelledby="fc-limits" className="rounded-lg border border-line bg-surface p-6">
          <h2 id="fc-limits" className="mb-4 text-h4 text-heading">
            {t("limits.title")}
          </h2>
          <ul className="flex list-disc flex-col gap-3 ps-5 text-small text-ink">
            <li>{t("limits.assumptions", { kgPerGuest: n(assumptions.kgPerGuest), margin: n(marginPct) })}</li>
            <li>{t("limits.attendance")}</li>
            <li>{t("limits.optional")}</li>
          </ul>

          {r.reductionKg === 0 ? (
            <p className="mt-4 rounded-md bg-selected px-4 py-3 text-caption text-heading">{t("noReduction")}</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <Button fullWidth disabled={draftsInvalid} onClick={() => decide("use_recommended")}>
              {t("actions.use", { kg: n(r.recommendedKg) })}
            </Button>
            {r.reductionKg > 0 ? (
              <Button fullWidth variant="secondary" disabled={draftsInvalid} onClick={() => decide("keep_planned")}>
                {t("actions.keep", { kg: n(r.plannedKg) })}
              </Button>
            ) : null}
            <Button
              fullWidth
              variant="ghost"
              aria-expanded={adjustOpen}
              aria-controls={adjustId}
              onClick={() => setAdjustOpen((o) => !o)}
            >
              {t(adjustOpen ? "actions.hideAdjust" : "actions.adjust")}
            </Button>
            {draftsInvalid ? (
              <p role="status" className="text-caption text-danger">
                {t("assumptions.invalid")}
              </p>
            ) : null}
          </div>

          {adjustOpen ? (
            <fieldset id={adjustId} className="mt-4 flex flex-col gap-4 rounded-md border border-line p-4">
              <legend className="px-1 text-small-strong text-heading">{t("assumptions.title")}</legend>
              <Field id="fc-kg" label={t("assumptions.kgPerGuest")} error={kgError}>
                <TextInput
                  id="fc-kg"
                  invalid={Boolean(kgError)}
                  aria-describedby={describedBy("fc-kg", { error: kgError })}
                  inputMode="decimal"
                  value={kgDraft}
                  onChange={(e) => onKgChange(e.target.value)}
                />
              </Field>
              <Field id="fc-margin" label={t("assumptions.margin")} error={marginError}>
                <TextInput
                  id="fc-margin"
                  invalid={Boolean(marginError)}
                  aria-describedby={describedBy("fc-margin", { error: marginError })}
                  inputMode="decimal"
                  value={marginDraft}
                  onChange={(e) => onMarginChange(e.target.value)}
                />
              </Field>
              <p className="text-caption text-muted">{t("assumptions.note")}</p>
              <Button variant="secondary" onClick={resetAssumptions}>
                {t("assumptions.reset")}
              </Button>
            </fieldset>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CalcRow({
  title,
  calc,
  value,
  highlight,
}: {
  title: string;
  calc: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4 rounded-md px-4 py-3",
        highlight ? "bg-selected" : "bg-page",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-small-strong text-heading">{title}</p>
        {/* dir=auto: a pure-number line ("210 − 180") reads left-to-right, as in Figma; Arabic lines stay RTL. */}
        <p dir="auto" className="text-small text-muted rtl:text-right">
          {calc}
        </p>
      </div>
      <p className={cn("tabular shrink-0 text-h4", highlight ? "text-action" : "text-heading")}>{value}</p>
    </li>
  );
}
