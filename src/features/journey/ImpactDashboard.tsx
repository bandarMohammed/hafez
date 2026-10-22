"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createSeed } from "@/data/seed";
import type { DemoDataset } from "@/domain/types";
import type { Locale } from "@/i18n/routing";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/components/ui/Icon";
import { useFormatters } from "@/features/common/useFormatters";
import { selectImpact } from "./impact";
import type { ImpactPoint, ImpactSummary } from "./impact";

/**
 * Chart colours: the Hafez green and gold, each moved one step in chroma so they pass the dataviz checks
 * (lightness band, chroma floor, colour-blind separation). Gold is under 3:1 on white, so both lines carry
 * direct end labels and the data is also available as a table.
 */
const RESCUED = "#1a8456";
const DISTRIBUTED = "#c28a28";

export function ImpactDashboard({ data }: { data: DemoDataset }) {
  const t = useTranslations("journey.impact");
  const f = useFormatters(data);
  const [now] = useState(() => new Date());
  // "Since the demo started" = compared with the seed records, so the change during the pitch is visible.
  const baseline = useMemo(() => selectImpact(createSeed(), now), [now]);
  const s = selectImpact(data, now);
  const delta = (k: keyof Omit<ImpactSummary, "series">) => s[k] - baseline[k];
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section
          aria-labelledby="impact-hero"
          className="flex flex-col justify-between gap-3 rounded-lg bg-inverse p-6 text-on-inverse md:col-span-2 xl:col-span-1"
        >
          <h3 id="impact-hero" className="text-small-strong text-accent-on-inverse">
            {t("hero.label")}
          </h3>
          <p className="flex items-baseline gap-2">
            <span className="text-[3.5rem] leading-none font-bold text-on-inverse">{f.n(s.rescuedKg)}</span>
            <span className="text-body-strong text-on-inverse">{t("kgUnit")}</span>
          </p>
          <p className="text-small text-on-inverse/85">
            {t("hero.breakdown", { halls: f.kg(s.hallsKg), reports: f.kg(s.reportsKg) })}
          </p>
          <Delta value={delta("rescuedKg")} format={f.kg} inverse />
        </section>
        <StatTile
          icon="foodSurplus"
          label={t("avoided.label")}
          value={f.kg(s.avoidedKg)}
          note={t("avoided.note")}
          tag={t("estimate")}
          delta={<Delta value={delta("avoidedKg")} format={f.kg} />}
        />
        <StatTile
          icon="heart"
          label={t("distributed.label")}
          value={f.kg(s.distributedKg)}
          note={t("distributed.note", { pct: f.n(pct(s.distributedKg, s.rescuedKg)) })}
          delta={<Delta value={delta("distributedKg")} format={f.kg} />}
        />
        <StatTile
          icon="shield"
          label={t("behavior.label")}
          value={f.n(s.confirmedPickups)}
          note={t("behavior.note", { pledges: f.n(s.pledges) })}
          delta={<Delta value={delta("confirmedPickups")} format={f.n} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="trend-title"
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 id="trend-title" className="text-body-strong text-heading">
                {t("trend.title")}
              </h3>
              <p className="text-caption text-muted">{t("trend.subtitle")}</p>
            </div>
            <ul className="flex flex-wrap gap-4 text-caption text-ink" aria-label={t("trend.legend")}>
              <LegendKey color={RESCUED} label={t("trend.rescued")} />
              <LegendKey color={DISTRIBUTED} label={t("trend.distributed")} />
            </ul>
          </div>
          {s.series.length ? (
            <TrendChart series={s.series} />
          ) : (
            <p className="text-small text-muted">{t("trend.empty")}</p>
          )}
        </section>

        <section
          aria-labelledby="path-title"
          className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-5"
        >
          <div className="flex flex-col gap-1">
            <h3 id="path-title" className="text-body-strong text-heading">
              {t("path.title")}
            </h3>
            <p className="text-caption text-muted">{t("path.subtitle")}</p>
          </div>
          <QuantityPath
            rows={[
              { key: "expected", value: s.expectedKg, estimate: true },
              { key: "rescued", value: s.rescuedKg },
              { key: "listed", value: s.listedKg, share: pct(s.listedKg, s.rescuedKg) },
              { key: "distributed", value: s.distributedKg, share: pct(s.distributedKg, s.rescuedKg) },
            ]}
            format={f.kg}
            n={f.n}
          />
        </section>
      </div>
      <p className="text-caption text-muted">{t("source")}</p>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  note,
  tag,
  delta,
}: {
  icon: IconKey;
  label: string;
  value: string;
  note: string;
  tag?: string;
  delta: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex size-10 items-center justify-center rounded-md bg-selected text-heading">
          <Icon name={icon} size={22} />
        </span>
        {tag ? <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-caption text-warning">{tag}</span> : null}
      </div>
      <h3 className="text-small text-muted">{label}</h3>
      <p className="text-metric text-heading">{value}</p>
      <p className="text-caption text-muted">{note}</p>
      {delta}
    </section>
  );
}

/** Change since the demo started; up is good for every impact measure here. */
function Delta({ value, format, inverse }: { value: number; format: (n: number) => string; inverse?: boolean }) {
  const t = useTranslations("journey.impact");
  const up = value > 0;
  return (
    <p
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-caption",
        inverse
          ? up
            ? "bg-inverse-raised text-gold-on-inverse"
            : "bg-inverse-raised text-accent-on-inverse"
          : up
            ? "bg-success-bg text-success"
            : "bg-surface-alt text-muted",
      )}
    >
      {up ? <Icon name="plus" size={14} /> : null}
      {up ? t("delta", { value: format(value) }) : t("noChange")}
    </p>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: color }} />
      {label}
    </li>
  );
}

/** Horizontal bars, one hue: estimates are a light wash, documented quantities solid. Values sit at the bar tip. */
function QuantityPath({
  rows,
  format,
  n,
}: {
  rows: Array<{ key: string; value: number; estimate?: boolean; share?: number }>;
  format: (v: number) => string;
  n: (v: number) => string;
}) {
  const t = useTranslations("journey.impact.path");
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="flex flex-col gap-4">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-small text-ink">
              {t(`rows.${r.key}`)}
              {r.estimate ? <span className="text-muted"> · {t("estimateTag")}</span> : null}
            </span>
            <span className="text-small-strong text-heading">
              {format(r.value)}
              {r.share !== undefined ? (
                <span className="text-caption font-normal text-muted"> · {t("share", { pct: n(r.share) })}</span>
              ) : null}
            </span>
          </div>
          <span className="block h-4 w-full rounded-e-[4px]" aria-hidden="true">
            <span
              className="block h-4 rounded-e-[4px]"
              style={{
                width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%`,
                background: RESCUED,
                opacity: r.estimate ? 0.3 : 1,
              }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

const niceMax = (v: number) => {
  if (v <= 10) return 10;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / (step / 2)) * (step / 2);
};

/** Cumulative line chart with a crosshair tooltip (pointer + keyboard) and a table view. */
function TrendChart({ series }: { series: ImpactPoint[] }) {
  const t = useTranslations("journey.impact.trend");
  const tk = useTranslations("journey.impact");
  const locale = useLocale() as Locale;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 240;
  const pad = { top: 16, bottom: 30, left: 36, right: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const yMax = niceMax(Math.max(...series.map((p) => Math.max(p.rescued, p.distributed))));
  const x = (i: number) => pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const path = (k: "rescued" | "distributed") => series.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[k])}`).join(" ");
  const area = `${path("rescued")} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(innerW / 90))));
  const last = series[series.length - 1]!;
  const day = (d: string) => formatShortDate(`${d}T12:00:00+03:00`, locale);
  const kg = (v: number) => tk("kgValue", { value: v });

  const nearest = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < series.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((a) => Math.min(series.length - 1, Math.max(0, (a ?? series.length - 1) + step)));
  };
  const point = active !== null ? series[active] : null;

  // End labels: keep them apart when the two series end close together.
  let yr = y(last.rescued);
  let yd = y(last.distributed);
  if (Math.abs(yr - yd) < 16) {
    const mid = (yr + yd) / 2;
    yr = mid - 8;
    yd = mid + 8;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={ref}
        className="relative w-full min-w-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-action"
        tabIndex={0}
        role="group"
        aria-label={t("aria", {
          from: kg(series[0]!.rescued),
          to: kg(last.rescued),
          distributed: kg(last.distributed),
        })}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerMove={(e: PointerEvent) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
      >
        <svg width={width} height={H} style={{ direction: "ltr" }} aria-hidden="true" className="block">
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
                {v}
              </text>
            </g>
          ))}
          {series.map((p, i) =>
            i % labelEvery === 0 || i === series.length - 1 ? (
              <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                {day(p.day)}
              </text>
            ) : null,
          )}
          <path d={area} fill={RESCUED} opacity={0.1} />
          <path
            d={path("rescued")}
            fill="none"
            stroke={RESCUED}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={path("distributed")}
            fill="none"
            stroke={DISTRIBUTED}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--color-muted)"
              strokeWidth={1}
            />
          ) : null}
          {(["rescued", "distributed"] as const).map((k) => {
            const i = active ?? series.length - 1;
            return (
              <circle
                key={k}
                cx={x(i)}
                cy={y(series[i]![k])}
                r={4.5}
                fill={k === "rescued" ? RESCUED : DISTRIBUTED}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            );
          })}
          <text x={x(series.length - 1) + 10} y={yr} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-ink)">
            {kg(last.rescued)}
          </text>
          <text x={x(series.length - 1) + 10} y={yd} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-ink)">
            {kg(last.distributed)}
          </text>
        </svg>
        {point ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 flex min-w-40 flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 shadow-raised"
            style={x(active!) > width / 2 ? { left: Math.max(4, x(active!) - 176) } : { left: x(active!) + 12 }}
          >
            <span className="text-caption text-muted">{day(point.day)}</span>
            <TooltipRow color={RESCUED} value={kg(point.rescued)} label={t("rescued")} />
            <TooltipRow color={DISTRIBUTED} value={kg(point.distributed)} label={t("distributed")} />
          </div>
        ) : null}
      </div>
      <details className="text-small">
        <summary className="w-fit cursor-pointer text-action">{t("table")}</summary>
        <table className="mt-2 w-full text-caption">
          <thead>
            <tr className="text-muted">
              <th className="py-1 text-start font-normal">{t("day")}</th>
              <th className="py-1 text-end font-normal">{t("rescued")}</th>
              <th className="py-1 text-end font-normal">{t("distributed")}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-1">{day(p.day)}</td>
                <td className="tabular py-1 text-end">{kg(p.rescued)}</td>
                <td className="tabular py-1 text-end">{kg(p.distributed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function TooltipRow({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-caption">
      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="text-small-strong text-heading">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}
