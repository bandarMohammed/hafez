"use client";

import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useDemoStore } from "@/data/store";
import { selectMyReports, selectShield } from "@/domain/selectors/beneficiary";
import type { DemoDataset, DemoUser } from "@/domain/types";
import { pledgeTip } from "@/domain/workflow/beneficiary";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFormatters } from "@/features/common/useFormatters";
import { useBeneficiary } from "./FoodScreens";

/* ================================================================ H5 */

/** Figma H5 — every number is derived from the points ledger and the user's own records. */
export function ShieldScreen() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <Shield data={data} user={user} />;
}

interface HistoryRow {
  key: string;
  id: string;
  points: number;
  title: string;
  detail: string;
  at: number;
}

function Shield({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("beneficiary.shield");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const s = selectShield(data, user.id);
  const cfg = DEMO_CONFIG.points;

  const rows: HistoryRow[] = s.history.map((p) => {
    if (p.reason === "request_confirmed") {
      const r = data.requests.find((x) => x.id === p.sourceId);
      const l = r && data.listings.find((x) => x.id === r.listingId);
      return {
        key: p.id,
        id: p.sourceId,
        points: p.points,
        title: t("history.request", {
          food: l?.title[locale] ?? "—",
          kg: f.kg((r?.confirmation?.receivedUnits ?? 0) * (l?.unitKg ?? 0)),
        }),
        detail: t("history.verified", { at: f.date(p.at) }),
        at: Date.parse(p.at),
      };
    }
    const rep = data.reports.find((x) => x.id === p.sourceId);
    return {
      key: p.id,
      id: p.sourceId,
      points: p.points,
      title: t("history.report", { food: rep?.foodType ?? "—", kg: f.kg(rep?.rescue?.actualKg ?? 0) }),
      detail: t("history.verified", { at: f.date(p.at) }),
      at: Date.parse(p.at),
    };
  });
  // Sent reports that haven't been documented yet show as 0 — sending never earns points (blueprint §2.1).
  for (const r of selectMyReports(data, user.id)) {
    if (r.status === "coordinated") continue;
    rows.push({
      key: r.id,
      id: r.id,
      points: 0,
      title: t("history.reportSent", { food: r.foodType }),
      detail: r.status === "rejected" ? t("history.rejected") : t("history.noPointsYet"),
      at: Date.parse(r.createdAt),
    });
  }
  rows.sort((a, b) => b.at - a.at);

  const badges: Array<{ icon: IconKey; label: string; on: boolean }> = [
    { icon: "check", label: t("badges.firstPickup"), on: s.confirmedPickups >= 1 },
    { icon: "lightbulb", label: t("badges.rescuer"), on: s.rescuedReports >= 1 },
    {
      icon: "award",
      label: t("badges.pickups", {
        n: f.n(Math.min(s.confirmedPickups, cfg.pickupsBadgeTarget)),
        target: f.n(cfg.pickupsBadgeTarget),
      }),
      on: s.confirmedPickups >= cfg.pickupsBadgeTarget,
    },
  ];
  const earned = s.history.filter((p) => p.points > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle")} />
      <section
        aria-labelledby="shield-level"
        className="flex flex-col items-center gap-3 rounded-xl bg-inverse p-6 text-center"
      >
        <span className="inline-flex size-28 items-center justify-center rounded-full border-[5px] border-gold-line bg-inverse-raised text-gold-on-inverse">
          <Icon name="shield" size={48} />
        </span>
        <h2 id="shield-level" className="text-h4 text-on-inverse">
          {t(`levels.${s.level}`)}
        </h2>
        <p className="flex items-baseline gap-2 text-on-inverse">
          <span className="text-metric text-gold-on-inverse" dir="ltr">
            {f.n(s.balance)}
          </span>
          <span className="text-small-strong">{t("points")}</span>
        </p>
        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(s.progress * 100)}
          className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-inverse-raised"
        >
          <div
            className="h-full rounded-full bg-gold-on-inverse"
            style={{ width: `${Math.round(s.progress * 100)}%` }}
          />
        </div>
        <p className="text-caption text-accent-on-inverse">
          {s.toNext === null
            ? t("maxLevel")
            : t(s.level === "bronze" ? "toSilver" : "toGold", {
                n: f.n(s.toNext),
                at: f.n(s.nextAt ?? 0),
                gold: f.n(cfg.goldAt),
              })}
        </p>
      </section>

      <section aria-labelledby="badges-title" className="flex flex-col gap-3">
        <h2 id="badges-title" className="text-body-strong text-heading">
          {t("badgesTitle")}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <li
              key={b.label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-2 py-3 text-center text-caption",
                b.on ? "bg-selected text-heading" : "bg-surface-alt text-muted opacity-80",
              )}
            >
              <Icon name={b.icon} size={24} />
              <span>{b.label}</span>
              <span className="sr-only">{b.on ? t("badgeOn") : t("badgeOff")}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="flex flex-col gap-2 bg-surface-alt p-5">
        <h2 className="text-small-strong text-heading">{t("rulesTitle")}</h2>
        <ul className="flex list-disc flex-col gap-1 ps-5 text-caption text-ink">
          <li>{t("rules.request", { n: f.n(cfg.requestConfirmed) })}</li>
          <li>{t("rules.report", { n: f.n(cfg.reportRescued) })}</li>
          <li>{t("rules.zero")}</li>
          <li>{t("rules.once")}</li>
        </ul>
      </Card>

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-body-strong text-heading">
          {t("historyTitle")}
        </h2>
        {rows.length ? (
          <Card className="p-4">
            <ul className="flex flex-col divide-y divide-line">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-small-strong text-ink">
                      {r.title} · <bdi>{r.id}</bdi>
                    </span>
                    <span className="text-caption text-muted">{r.detail}</span>
                  </div>
                  <span
                    dir="ltr"
                    className={cn("shrink-0 text-body-strong", r.points > 0 ? "text-success" : "text-muted")}
                  >
                    {r.points > 0 ? `+${f.n(r.points)}` : f.n(0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-small text-muted">
                {earned.length
                  ? t("balanceSum", { sum: earned.map((p) => f.n(p.points)).join(" + ") })
                  : t("balanceZero")}
              </span>
              <span dir="ltr" className="text-h4 text-heading">
                {f.n(s.balance)}
              </span>
            </div>
          </Card>
        ) : (
          <p className="rounded-md bg-surface-alt px-4 py-3 text-small text-muted">{t("historyEmpty")}</p>
        )}
      </section>
    </div>
  );
}

/* ================================================================ H6 */

/** Demo awareness tip (one fixed tip in this prototype). */
export const TIP_ID = "tip-batch-serving";

/** Figma H6 — awareness tip with an optional weekly pledge; neither earns points. */
export function TipScreen() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <Tip data={data} user={user} />;
}

function Tip({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("beneficiary.tip");
  const dispatch = useDemoStore((s) => s.dispatch);
  const pledged = data.pledges.some((p) => p.userId === user.id && p.tipId === TIP_ID);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader className="mb-0" back={{ href: "/beneficiary", label: t("back") }} title={t("pageTitle")} />
      <section className="flex flex-col gap-3 rounded-xl bg-surface-alt p-6">
        <span className="inline-flex size-16 items-center justify-center rounded-lg bg-selected text-heading">
          <Icon name="lightbulb" size={32} />
        </span>
        <p className="text-caption text-action">{t("eyebrow")}</p>
        <h2 className="text-h3 text-heading">{t("title")}</h2>
        <p className="text-body text-ink">{t("body")}</p>
        <div className="flex items-center gap-2 rounded-md bg-surface px-4 py-3 text-small text-ink">
          <Icon name={pledged ? "check" : "heart"} size={18} className="shrink-0" />
          <span>{pledged ? t("pledgedText") : t("pledgeText")}</span>
        </div>
      </section>
      <Notice tone="info">{t("honesty")}</Notice>
      <div className="flex flex-col gap-3">
        <Button fullWidth disabled={pledged} onClick={() => dispatch((c) => pledgeTip(c, TIP_ID))}>
          {pledged ? t("pledged") : t("pledge")}
        </Button>
        <ButtonLink fullWidth variant="ghost" href="/beneficiary">
          {t("done")}
        </ButtonLink>
      </div>
    </div>
  );
}
