"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { normalizeDigits } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import type { DemoDataset, SurplusReport } from "@/domain/types";
import { recordReportResult } from "@/domain/workflow/field";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RadioCards } from "@/components/ui/Choice";
import { DetailList } from "@/components/ui/DetailList";
import { Field, TextArea, TextInput, describedBy } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { useFormatters } from "@/features/common/useFormatters";
import { useField } from "./FieldTasks";

/**
 * Inspection of a beneficiary surplus report (blueprint matrix: "معاينة إذا أُسندت له"; Figma D7 step 3).
 * The representative records what was actually rescued; the charity then documents it (points come after).
 */
export function ReportInspectionScreen({ reportId }: { reportId: string }) {
  const t = useTranslations("fieldScreens.report");
  const { user, data } = useField();
  if (!user || !data) return null;
  const report = data.reports.find((r) => r.id === reportId && r.inspection?.representativeId === user.id);
  if (!report) {
    return (
      <StateMessage
        asPage
        icon="lock"
        tone="info"
        title={t("notFound")}
        actions={<ButtonLink href="/field">{t("back")}</ButtonLink>}
      />
    );
  }
  return <ReportView data={data} report={report} canRecord={can(user, "report.inspect", { kind: "report", report })} />;
}

function ReportView({ data, report, canRecord }: { data: DemoDataset; report: SurplusReport; canRecord: boolean }) {
  const t = useTranslations("fieldScreens.report");
  const tu = useTranslations("field.units");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const [outcome, setOutcome] = useState<"rescued" | "not_suitable" | null>(null);
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const result = report.inspection?.result;

  const submit = () => {
    const q = normalizeDigits(kg).replace(/[٫,]/g, ".").trim();
    const r = dispatch(
      (c) =>
        recordReportResult(c, report.id, {
          outcome,
          actualKg: q && /^\d+(\.\d+)?$/.test(q) ? Number(q) : null,
          note: note || null,
        }),
      { flashOn: "/field" },
    );
    if (r.ok) router.push("/field");
    else setErrors(r.fields ?? {});
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/field", label: t("back") }}
        title={t("title", { report: report.id })}
        badge={<RequestStatusBadge status={report.status} />}
        subtitle={t("subtitle")}
      />
      <Card className="p-5">
        <DetailList
          items={[
            { label: t("foodType"), value: report.foodType },
            {
              label: t("estimate"),
              value: t("estimateValue", { qty: f.n(report.estimatedQuantity), unit: tu(report.unit) }),
            },
            { label: t("area"), value: t("areaValue", { area: report.area[locale] }) },
            { label: t("readyAt"), value: f.shortDateTime(report.readyAt) },
            { label: t("planned"), value: f.dateTime(report.inspection!.plannedAt) },
            report.notes ? { label: t("notes"), value: report.notes } : null,
            result
              ? {
                  label: t("result"),
                  value:
                    result.outcome === "rescued"
                      ? t("rescued", { qty: f.kg(result.actualKg ?? 0) })
                      : t("notSuitable", { note: result.note ?? "" }),
                }
              : null,
          ]}
        />
      </Card>
      {canRecord ? (
        <>
          <Card className="flex flex-col gap-5 p-5">
            <RadioCards
              name="report-outcome"
              legend={t("outcome")}
              required
              value={outcome}
              onChange={(o) => {
                setOutcome(o);
                setErrors({});
              }}
              error={errors.outcome ? t("errors.outcome") : undefined}
              errorId="rpi-outcome-error"
              options={[
                {
                  value: "rescued",
                  title: t("outcomes.rescued.title"),
                  description: t("outcomes.rescued.description"),
                },
                {
                  value: "not_suitable",
                  title: t("outcomes.not_suitable.title"),
                  description: t("outcomes.not_suitable.description"),
                },
              ]}
            />
            {outcome === "rescued" ? (
              <Field
                id="rpi-kg"
                label={t("actualKg")}
                required
                error={errors.actualKg ? t("errors.actualKg") : undefined}
              >
                <TextInput
                  id="rpi-kg"
                  inputMode="decimal"
                  value={kg}
                  invalid={Boolean(errors.actualKg)}
                  aria-describedby={describedBy("rpi-kg", {
                    error: errors.actualKg ? t("errors.actualKg") : undefined,
                  })}
                  onChange={(e) => setKg(e.target.value)}
                />
              </Field>
            ) : null}
            <Field
              id="rpi-note"
              label={t("note")}
              required={outcome === "not_suitable"}
              error={errors.note ? t("errors.note") : undefined}
            >
              <TextArea
                id="rpi-note"
                value={note}
                invalid={Boolean(errors.note)}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Notice tone="warning">{t("rule")}</Notice>
          </Card>
          <Button fullWidth onClick={submit}>
            {t("submit")}
          </Button>
        </>
      ) : (
        <p className="rounded-md bg-selected px-4 py-3 text-small text-heading">
          {result ? t("waitingCharity") : t("closed")}
        </p>
      )}
    </div>
  );
}
