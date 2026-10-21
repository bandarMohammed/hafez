"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useDemoStore } from "@/data/store";
import { eventDateOptions, timeSlots } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import { selectCharityReports, selectTeam } from "@/domain/selectors/charity";
import type { DemoDataset, DemoUser, SurplusReport } from "@/domain/types";
import { acceptReport, documentRescue, rejectReport, requestReportInfo } from "@/domain/workflow/charity";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Card";
import { DetailList } from "@/components/ui/DetailList";
import { Field, SelectInput, TextArea, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatDate } from "@/lib/format";
import { useFormatters } from "@/features/common/useFormatters";
import { useCharity } from "./Opportunities";

const OFFSET = DEMO_CONFIG.newEvent.utcOffset;

/** Steps of Figma D7: received → review → inspection if needed → documented rescue → impact & points. */
const STEPS = ["received", "review", "inspection", "documentation", "impact"] as const;
function reportStep(r: SurplusReport): number {
  if (r.status === "coordinated") return 5;
  if (r.status === "accepted") return r.inspection?.result ? 3 : 2;
  return 1;
}

export function ReportsScreen() {
  const { user, data } = useCharity();
  if (!user || !data) return null;
  return <ReportsList data={data} user={user} />;
}

function ReportsList({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("charity.reports");
  const f = useFormatters(data);
  const reports = selectCharityReports(data, user.organizationId!);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
      {reports.length === 0 ? (
        <Card>
          <StateMessage icon="heart" title={t("emptyTitle")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <li key={r.id}>
              <RecordCard
                href={`/charity/reports/${r.id}`}
                highlight={r.status === "pending" || (r.status === "accepted" && Boolean(r.inspection?.result))}
                title={
                  <>
                    {r.foodType} ·{" "}
                    {r.rescue
                      ? t("actualKg", { qty: f.n(r.rescue.actualKg) })
                      : t("estimateKg", { qty: f.n(r.estimatedQuantity) })}{" "}
                    · <bdi>{r.id}</bdi>
                  </>
                }
                badge={<RequestStatusBadge status={r.status} />}
                meta={[
                  { icon: "location", text: t("areaReady", { area: r.area[f.locale], time: f.time(r.readyAt) }) },
                  { icon: "time", text: t("sentAt", { at: f.shortDateTime(r.createdAt) }) },
                  { icon: "info", text: summaryLine(r, t, f) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summaryLine(
  r: SurplusReport,
  t: ReturnType<typeof useTranslations>,
  f: ReturnType<typeof useFormatters>,
): string {
  switch (r.status) {
    case "pending":
      return r.infoRequest?.answer ? t("lines.answered") : t("lines.pending");
    case "needs_info":
      return t("lines.needsInfo", { question: r.infoRequest?.question ?? "" });
    case "accepted":
      return r.inspection?.result
        ? t("lines.resultIn", { outcome: t(`outcome.${r.inspection.result.outcome}`) })
        : t("lines.assigned", {
            rep: f.userName(r.inspection?.representativeId),
            at: f.shortDateTime(r.inspection?.plannedAt ?? r.createdAt),
          });
    case "coordinated":
      return t("lines.rescued", { at: f.date(r.rescue?.documentedAt ?? r.createdAt) });
    case "rejected":
      return t("lines.rejected", { reason: r.rejectReason ?? "" });
  }
}

/* ================================================================ D7 detail */

export function ReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("charity.reports");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const report = data.reports.find((r) => r.id === reportId);
  if (!report || !can(user, "report.review", { kind: "report", report })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/charity/reports">{t("back")}</ButtonLink>}
      />
    );
  }
  return <ReportView key={report.id + report.status} data={data} report={report} />;
}

function ReportView({ data, report }: { data: DemoDataset; report: SurplusReport }) {
  const t = useTranslations("charity.reports");
  const tu = useTranslations("field.units");
  const locale = useLocale() as Locale;
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const [panel, setPanel] = useState<"accept" | "info" | "reject" | null>(null);
  const [now] = useState(() => new Date());
  const dates = useMemo(() => eventDateOptions(now).slice(0, 7), [now]);
  const slots = useMemo(() => timeSlots(), []);
  const team = selectTeam(data, report.charityId, now.toISOString());
  const [rep, setRep] = useState(team[0]?.user.id ?? "");
  const [day, setDay] = useState(dates[1] ?? dates[0] ?? "");
  const [slot, setSlot] = useState("11:00");
  const [text, setText] = useState(
    report.inspection?.result?.outcome === "not_suitable" ? (report.inspection.result.note ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const step = reportStep(report);
  const reviewing = report.status === "pending" || report.status === "needs_info";
  const result = report.inspection?.result;

  const run = (cmd: Parameters<typeof dispatch>[0]) => {
    const r = dispatch(cmd);
    if (r.ok) {
      setPanel(null);
      setError(null);
    } else setError(t("errors.required"));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/reports", label: t("back") }}
        title={t("detailTitle", { report: report.id })}
        badge={<RequestStatusBadge status={report.status} />}
        subtitle={t("rule")}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel title={t("detailsTitle")} titleId="rp-details">
            <DetailList
              items={[
                { label: t("fields.foodType"), value: report.foodType },
                {
                  label: t("fields.quantity"),
                  value: t("fields.quantityValue", { qty: f.n(report.estimatedQuantity), unit: tu(report.unit) }),
                },
                { label: t("fields.readyAt"), value: f.shortDateTime(report.readyAt) },
                { label: t("fields.area"), value: t("fields.areaValue", { area: report.area[locale] }) },
                { label: t("fields.notes"), value: report.notes ?? t("fields.none") },
                { label: t("fields.photo"), value: report.photoAttached ? t("fields.photoYes") : t("fields.photoNo") },
                { label: t("fields.reporter"), value: f.userName(report.reporterId) },
                report.infoRequest ? { label: t("fields.question"), value: report.infoRequest.question } : null,
                report.infoRequest
                  ? { label: t("fields.answer"), value: report.infoRequest.answer ?? t("fields.waitingAnswer") }
                  : null,
                report.inspection
                  ? {
                      label: t("fields.inspection"),
                      value: t("fields.inspectionValue", {
                        rep: f.userName(report.inspection.representativeId),
                        at: f.shortDateTime(report.inspection.plannedAt),
                      }),
                    }
                  : null,
                result
                  ? {
                      label: t("fields.result"),
                      value:
                        result.outcome === "rescued"
                          ? t("fields.resultRescued", { qty: f.kg(result.actualKg ?? 0) })
                          : t("fields.resultNotSuitable", { note: result.note ?? "" }),
                    }
                  : null,
                report.rescue
                  ? {
                      label: t("fields.rescue"),
                      value: t("fields.rescueValue", {
                        qty: f.kg(report.rescue.actualKg),
                        at: f.date(report.rescue.documentedAt),
                      }),
                    }
                  : null,
                report.status === "rejected"
                  ? { label: t("fields.rejectReason"), value: report.rejectReason ?? "—" }
                  : null,
              ]}
            />
          </Panel>
          <Notice tone="warning">{t("safetyNote")}</Notice>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title={t("pathTitle")} titleId="rp-path">
            <ol className="flex flex-col gap-3">
              {STEPS.map((s, i) => {
                const done = report.status !== "rejected" && i < step;
                const current = report.status !== "rejected" && i === step;
                return (
                  <li key={s} aria-current={current ? "step" : undefined} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-caption",
                        done
                          ? "border-action bg-action text-on-action"
                          : current
                            ? "border-action bg-selected text-heading"
                            : "border-line-strong text-muted",
                      )}
                    >
                      {done ? <Icon name="check" size={16} /> : i + 1}
                    </span>
                    <span className={cn("text-small", current ? "font-bold text-heading" : "text-muted")}>
                      {t(`steps.${s}`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel title={t("actionsTitle")} titleId="rp-actions">
            {error ? <p className="mb-3 text-caption text-danger">{error}</p> : null}
            {reviewing ? (
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setPanel(panel === "accept" ? null : "accept")}
                  aria-expanded={panel === "accept"}
                >
                  {t("accept")}
                </Button>
                {panel === "accept" ? (
                  <div className="flex flex-col gap-3 rounded-md border border-line p-3">
                    <Field id="rp-rep" label={t("rep")} required>
                      <SelectInput id="rp-rep" value={rep} onChange={(e) => setRep(e.target.value)}>
                        {team.map((m) => (
                          <option key={m.user.id} value={m.user.id}>
                            {m.user.displayName?.[locale] ?? m.user.id}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="rp-day" label={t("day")} required>
                        <SelectInput id="rp-day" value={day} onChange={(e) => setDay(e.target.value)}>
                          {dates.map((d) => (
                            <option key={d} value={d}>
                              {formatDate(`${d}T12:00:00${OFFSET}`, locale)}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field id="rp-slot" label={t("time")} required>
                        <SelectInput id="rp-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                          {slots.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        run((c) =>
                          acceptReport(c, report.id, {
                            representativeId: rep,
                            plannedAt: `${day}T${slot}:00${OFFSET}`,
                          }),
                        )
                      }
                    >
                      {t("confirmAccept")}
                    </Button>
                  </div>
                ) : null}
                {report.status === "pending" ? (
                  <Button
                    variant="secondary"
                    onClick={() => setPanel(panel === "info" ? null : "info")}
                    aria-expanded={panel === "info"}
                  >
                    {t("requestInfo")}
                  </Button>
                ) : null}
                {panel === "info" ? (
                  <TextPanel
                    id="rp-question"
                    label={t("question")}
                    value={text}
                    onChange={setText}
                    action={t("sendQuestion")}
                    onSubmit={() => run((c) => requestReportInfo(c, report.id, text))}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => setPanel(panel === "reject" ? null : "reject")}
                  aria-expanded={panel === "reject"}
                >
                  {t("reject")}
                </Button>
                {panel === "reject" ? (
                  <TextPanel
                    id="rp-reason"
                    label={t("reason")}
                    value={text}
                    onChange={setText}
                    action={t("confirmReject")}
                    danger
                    onSubmit={() => run((c) => rejectReport(c, report.id, text))}
                  />
                ) : null}
              </div>
            ) : report.status === "accepted" && !result ? (
              <p className="text-small text-muted">{t("waitingResult")}</p>
            ) : report.status === "accepted" && result?.outcome === "rescued" ? (
              <div className="flex flex-col gap-3">
                <p className="text-small text-ink">{t("rescueHint", { qty: f.kg(result.actualKg ?? 0) })}</p>
                <Button onClick={() => run((c) => documentRescue(c, report.id))}>
                  {t("document", { qty: f.kg(result.actualKg ?? 0) })}
                </Button>
              </div>
            ) : report.status === "accepted" && result?.outcome === "not_suitable" ? (
              <TextPanel
                id="rp-reason"
                label={t("reason")}
                value={text}
                onChange={setText}
                action={t("closeNotSuitable")}
                danger
                onSubmit={() => run((c) => rejectReport(c, report.id, text))}
              />
            ) : (
              <p className="text-small text-muted">{t("closed")}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TextPanel({
  id,
  label,
  value,
  onChange,
  action,
  onSubmit,
  danger,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  action: string;
  onSubmit: () => void;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-3">
      <Field id={id} label={label} required>
        <TextArea
          id={id}
          value={value}
          aria-describedby={describedBy(id, {})}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <Button variant={danger ? "danger" : "secondary"} onClick={onSubmit}>
        {action}
      </Button>
    </div>
  );
}
