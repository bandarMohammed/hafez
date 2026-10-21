"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useDemoStore } from "@/data/store";
import { addDays, normalizeDigits, riyadhDate, timeSlots } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import { selectMyReports } from "@/domain/selectors/beneficiary";
import type { DemoDataset, DemoUser, SurplusReport } from "@/domain/types";
import { answerReportInfo, createReport, validateReport } from "@/domain/workflow/beneficiary";
import type { ReportInput } from "@/domain/workflow/beneficiary";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SelectInput, TextArea, TextInput, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { useFormatters } from "@/features/common/useFormatters";
import { useAreaOptions } from "@/features/charity/Listings";
import { useBeneficiary } from "./FoodScreens";

const OFFSET = DEMO_CONFIG.newEvent.utcOffset;
const FOOD_KINDS = ["cooked", "rice", "pastries", "bread", "desserts", "other"] as const;
const UNITS = ["kg", "meal_portions", "boxes"] as const;

/* ================================================================ H4 */

/** Figma H4 — sent for review only; never published automatically and earns nothing on sending. */
export function ReportSurplusScreen() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <ReportForm data={data} />;
}

function ReportForm({ data }: { data: DemoDataset }) {
  const t = useTranslations("beneficiary.report");
  const tu = useTranslations("field.units");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const areas = useAreaOptions(data);
  const [today] = useState(() => riyadhDate(new Date()));
  const days = useMemo(() => [today, addDays(today, 1)], [today]);
  const slots = useMemo(() => timeSlots(), []);
  const [v, setV] = useState({
    food: "" as (typeof FOOD_KINDS)[number] | "",
    foodOther: "",
    qty: "",
    unit: "kg" as (typeof UNITS)[number],
    day: today,
    slot: "",
    area: "",
    notes: "",
    photo: null as string | null,
  });
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [k]: value }));

  const input = (): ReportInput => {
    const q = normalizeDigits(v.qty).replace(/[٫,]/g, ".").trim();
    return {
      foodType: v.food === "other" ? v.foodOther : v.food ? t(`foodKinds.${v.food}`) : "",
      estimatedQuantity: q && /^\d+(\.\d+)?$/.test(q) ? Number(q) : null,
      unit: v.unit,
      readyAt: v.slot ? `${v.day}T${v.slot}:00${OFFSET}` : "",
      area: areas.find((a) => a.en === v.area) ?? null,
      notes: v.notes,
      photoAttached: Boolean(v.photo),
    };
  };
  const errors = attempted ? validateReport(input()) : {};
  const err = (k: string) =>
    errors[k] ? t(`errors.${k === "foodType" && v.food === "other" ? "foodOther" : k}`) : undefined;
  const a11y = (id: string, k: string, hint?: string) => ({
    id,
    invalid: Boolean(errors[k]),
    "aria-describedby": describedBy(id, { error: err(k), hint }),
  });

  const submit = () => {
    setAttempted(true);
    const r = dispatch((c) => createReport(c, input()), { flashOn: "/beneficiary/reports" });
    if (r.ok) router.push("/beneficiary/reports");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <ButtonLink href="/beneficiary/reports" variant="secondary">
            {t("myReports")}
          </ButtonLink>
        }
      />
      {attempted && Object.keys(errors).length ? (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-4 py-3 text-small text-danger">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>{t("notSent")}</span>
        </div>
      ) : null}
      <Card className="flex flex-col gap-5 p-5">
        <Field id="rp-food" label={t("foodType")} required error={v.food === "other" ? undefined : err("foodType")}>
          <SelectInput
            {...a11y("rp-food", v.food === "other" ? "_" : "foodType")}
            value={v.food}
            onChange={(e) => set("food", e.target.value as typeof v.food)}
          >
            <option value="">{t("choose")}</option>
            {FOOD_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`foodKinds.${k}`)}
              </option>
            ))}
          </SelectInput>
        </Field>
        {v.food === "other" ? (
          <Field id="rp-food-other" label={t("foodOther")} required error={err("foodType")}>
            <TextInput
              {...a11y("rp-food-other", "foodType")}
              value={v.foodOther}
              onChange={(e) => set("foodOther", e.target.value)}
            />
          </Field>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <Field id="rp-qty" label={t("quantity")} required error={err("estimatedQuantity")} hint={t("quantityHint")}>
            <TextInput
              {...a11y("rp-qty", "estimatedQuantity", t("quantityHint"))}
              inputMode="decimal"
              value={v.qty}
              onChange={(e) => set("qty", e.target.value)}
            />
          </Field>
          <Field id="rp-unit" label={t("unit")} required>
            <SelectInput id="rp-unit" value={v.unit} onChange={(e) => set("unit", e.target.value as typeof v.unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {tu(u)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="rp-day" label={t("readyDay")} required>
            <SelectInput id="rp-day" value={v.day} onChange={(e) => set("day", e.target.value)}>
              {days.map((d, i) => (
                <option key={d} value={d}>
                  {t(i === 0 ? "today" : "tomorrow", { date: formatDate(`${d}T12:00:00${OFFSET}`, locale) })}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="rp-time" label={t("readyTime")} required error={err("readyAt")}>
            <SelectInput {...a11y("rp-time", "readyAt")} value={v.slot} onChange={(e) => set("slot", e.target.value)}>
              <option value="">{t("choose")}</option>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id="rp-area" label={t("area")} required error={err("area")} hint={t("areaHint")}>
          <SelectInput
            {...a11y("rp-area", "area", t("areaHint"))}
            value={v.area}
            onChange={(e) => set("area", e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {areas.map((a) => (
              <option key={a.en} value={a.en}>
                {t("areaOption", { area: a[locale] })}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="rp-notes" label={t("notes")} error={err("notes")}>
          <TextArea
            {...a11y("rp-notes", "notes")}
            value={v.notes}
            maxLength={300}
            placeholder={t("notesPlaceholder")}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
        {/* Optional photo: only the fact that one was chosen is kept — the image is never read or stored. */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="rp-photo"
            className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-line-strong bg-surface px-4 py-4 text-small-strong text-action focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action"
          >
            <Icon name="camera" size={20} />
            <span>{v.photo ? t("photoChosen", { name: v.photo }) : t("photo")}</span>
            <input
              id="rp-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              aria-describedby="rp-photo-hint"
              onChange={(e) => set("photo", e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <p id="rp-photo-hint" className="text-caption text-muted">
            {t("photoHint")}
          </p>
          {v.photo ? (
            <Button variant="ghost" className="w-fit" onClick={() => set("photo", null)}>
              {t("photoRemove")}
            </Button>
          ) : null}
        </div>
        <Notice tone="warning">{t("safety")}</Notice>
      </Card>
      <Button fullWidth onClick={submit}>
        {t("submit")}
      </Button>
    </div>
  );
}

/* ================================================================ H8 */

export function MyReportsScreen() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <MyReports data={data} user={user} />;
}

function MyReports({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("beneficiary.reports");
  const mine = selectMyReports(data, user.id);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/beneficiary/report", label: t("back") }}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      {mine.length ? (
        <ul className="flex flex-col gap-3">
          {mine.map((r) => (
            <li key={r.id}>
              <ReportItem data={data} user={user} report={r} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <StateMessage
            icon="clipboard"
            title={t("emptyTitle")}
            body={t("emptyBody")}
            actions={<ButtonLink href="/beneficiary/report">{t("newReport")}</ButtonLink>}
          />
        </Card>
      )}
    </div>
  );
}

function ReportItem({ data, user, report: r }: { data: DemoDataset; user: DemoUser; report: SurplusReport }) {
  const t = useTranslations("beneficiary.reports");
  const tu = useTranslations("field.units");
  const f = useFormatters(data);
  const dispatch = useDemoStore((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const points = data.points.find((p) => p.reason === "report_rescued" && p.sourceId === r.id);
  const qty = r.rescue
    ? t("actual", { qty: f.kg(r.rescue.actualKg) })
    : t("estimate", { qty: f.n(r.estimatedQuantity), unit: tu(r.unit) });

  const lines: Array<{ text: string; tone?: "strong" | "success" }> = [];
  switch (r.status) {
    case "pending":
      lines.push({
        text: r.infoRequest?.answer
          ? t("lines.answered")
          : t("lines.pending", { at: f.shortDateTime(r.createdAt), charity: f.orgName(r.charityId) }),
      });
      lines.push({ text: t("lines.notPublished"), tone: "strong" });
      break;
    case "needs_info":
      lines.push({ text: t("lines.needsInfo", { question: r.infoRequest?.question ?? "—" }) });
      break;
    case "accepted":
      lines.push({
        text: r.inspection?.result
          ? t("lines.resultIn")
          : t("lines.accepted", {
              rep: f.userName(r.inspection?.representativeId),
              at: r.inspection ? f.shortDateTime(r.inspection.plannedAt) : "—",
            }),
      });
      lines.push({ text: t("lines.notCounted"), tone: "strong" });
      break;
    case "coordinated":
      lines.push({
        text: t("lines.rescued", {
          at: f.date(r.rescue?.documentedAt ?? r.createdAt),
          points: f.n(points?.points ?? 0),
        }),
        tone: "success",
      });
      break;
    case "rejected":
      lines.push({ text: t("lines.rejected", { reason: r.rejectReason ?? "—" }) });
      break;
  }

  const send = () => {
    const res = dispatch((c) => answerReportInfo(c, r.id, answer));
    if (res.ok) {
      setOpen(false);
      setAnswer("");
    } else setError(true);
  };
  const canAnswer = can(user, "report.answer", { kind: "report", report: r });

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-body-strong text-heading">
          {r.foodType} · {qty} · <bdi>{r.id}</bdi>
        </h2>
        <RequestStatusBadge status={r.status} className="shrink-0" />
      </div>
      {lines.map((l, i) => (
        <p
          key={i}
          className={cn(
            "text-small",
            l.tone === "success" ? "text-success" : l.tone === "strong" ? "text-ink" : "text-muted",
          )}
        >
          {l.text}
        </p>
      ))}
      {canAnswer && !open ? (
        <Button variant="secondary" className="mt-1 w-full sm:w-fit" onClick={() => setOpen(true)}>
          {t("addInfo")}
        </Button>
      ) : null}
      {canAnswer && open ? (
        <div className="mt-1 flex flex-col gap-3">
          <Field id={`ans-${r.id}`} label={t("answerLabel")} required error={error ? t("answerRequired") : undefined}>
            <TextArea
              id={`ans-${r.id}`}
              value={answer}
              invalid={error}
              aria-describedby={describedBy(`ans-${r.id}`, { error: error ? t("answerRequired") : undefined })}
              onChange={(e) => {
                setAnswer(e.target.value);
                setError(false);
              }}
            />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={send}>{t("sendAnswer")}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
