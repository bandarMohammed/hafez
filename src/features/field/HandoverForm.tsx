"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useDemoStore } from "@/data/store";
import { addDays, normalizeDigits, riyadhDate, timeSlots } from "@/domain/newEvent";
import { can, eventRelations } from "@/domain/permissions";
import { selectEventRecords } from "@/domain/selectors/event";
import { QUANTITY_UNITS } from "@/domain/types";
import type { DemoDataset, DemoUser, HallEvent, QuantityUnit } from "@/domain/types";
import { recordHandover, validateHandover } from "@/domain/workflow/field";
import type { HandoverInput } from "@/domain/workflow/field";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SelectInput, TextInput, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFormatters } from "@/features/common/useFormatters";
import { TaskNotFound, useTask } from "./TaskDetail";

const OFFSET = DEMO_CONFIG.newEvent.utcOffset;
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: DEMO_CONFIG.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

/** Figma E4 — provisional handover; «تم الاستلام» completes only after the charity confirms (D5). */
export function HandoverScreen({ eventId }: { eventId: string }) {
  const { user, data, event } = useTask(eventId);
  if (!user || !data) return null;
  if (!event) return <TaskNotFound />;
  const rel = eventRelations(data, event, user);
  const handover = data.handovers.find((h) => h.eventId === event.id);
  const editable =
    !handover || handover.confirmationStatus === "pending" || handover.confirmationStatus === "confirmed_by_hall";
  if (!can(user, "handover.record", { kind: "event", event, rel }) || !editable) return <TaskNotFound />;
  return <HandoverForm data={data} user={user} event={event} />;
}

function HandoverForm({ data, user, event }: { data: DemoDataset; user: DemoUser; event: HallEvent }) {
  const t = useTranslations("fieldScreens.handover");
  const tr = useTranslations("field");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const records = selectEventRecords(data, event.id);
  const existing = records.handover;
  const rel = eventRelations(data, event, user);
  const readyDay = riyadhDate(new Date(event.foodReadyAt));
  const days = useMemo(() => [readyDay, addDays(readyDay, 1)], [readyDay]);
  const slots = useMemo(() => timeSlots(), []);
  const defaultSlot = (() => {
    const [h, m] = hhmm(event.foodReadyAt).split(":").map(Number);
    const total = (h! * 60 + m! + 30) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(Math.floor((total % 60) / 30) * 30).padStart(2, "0")}`;
  })();
  const [v, setV] = useState({
    qty: existing ? String(existing.actualQuantity) : "",
    unit: (existing?.unit ?? "kg") as QuantityUnit,
    foodTypes: existing?.foodTypesText ?? "",
    day: existing ? riyadhDate(new Date(existing.handedOverAt)) : readyDay,
    slot: existing ? hhmm(existing.handedOverAt) : defaultSlot,
    handedBy: existing?.handedBy ?? "",
  });
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [k]: value }));

  const input = (): HandoverInput => {
    const q = normalizeDigits(v.qty).replace(/[٫,]/g, ".").trim();
    return {
      actualQuantity: q && /^\d+(\.\d+)?$/.test(q) ? Number(q) : null,
      unit: v.unit,
      foodTypesText: v.foodTypes,
      handedOverAt: `${v.day}T${v.slot}:00${OFFSET}`,
      handedBy: v.handedBy,
    };
  };
  const errors = attempted ? validateHandover(input()) : {};
  const err = (k: string) => (errors[k] ? t(`errors.${k}`, { estimate: estimateText }) : undefined);
  const estimateText =
    records.inspection?.estimatedQuantity && records.inspection.unit
      ? `${f.n(records.inspection.estimatedQuantity)} ${tr(`units.${records.inspection.unit}`)}`
      : "—";

  const submit = () => {
    setAttempted(true);
    const r = dispatch((c) => recordHandover(c, event.id, input()), { flashOn: `/field/tasks/${event.id}` });
    if (r.ok) router.push(`/field/tasks/${event.id}`);
  };
  const a11y = (id: string, k: string, hint?: string) => ({
    id,
    invalid: Boolean(errors[k]),
    "aria-describedby": describedBy(id, { error: err(k), hint }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: `/field/tasks/${event.id}`, label: t("back") }}
        title={t("title", { event: event.id })}
        subtitle={t("subtitle")}
      />
      {attempted && Object.keys(errors).length ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
          <Icon name="alert" size={22} className="shrink-0 text-danger" />
          <div className="flex flex-col gap-1">
            <p className="text-body-strong text-heading">{t("cannotConfirm")}</p>
            <p className="text-small text-muted">{errors.actualQuantity ? t("qtyRequired") : t("fixFields")}</p>
          </div>
        </div>
      ) : null}
      {existing?.dispute ? (
        <p className="rounded-md bg-warning-bg px-4 py-3 text-small text-warning">
          {t("disputed", { note: existing.dispute.note })}
        </p>
      ) : null}
      <Card className="flex flex-col gap-5 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <Field
            id="ho-qty"
            label={t("actual")}
            required
            error={err("actualQuantity")}
            hint={t("actualHint", { estimate: estimateText })}
          >
            <TextInput
              {...a11y("ho-qty", "actualQuantity", t("actualHint", { estimate: estimateText }))}
              inputMode="decimal"
              placeholder={t("qtyPlaceholder")}
              value={v.qty}
              onChange={(e) => set("qty", e.target.value)}
            />
          </Field>
          <Field id="ho-unit" label={t("unit")} required>
            <SelectInput id="ho-unit" value={v.unit} onChange={(e) => set("unit", e.target.value as QuantityUnit)}>
              {QUANTITY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {tr(`units.${u}`)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id="ho-food" label={t("foodTypes")} required error={err("foodTypesText")}>
          <TextInput
            {...a11y("ho-food", "foodTypesText")}
            placeholder={t("foodPlaceholder")}
            value={v.foodTypes}
            onChange={(e) => set("foodTypes", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ho-day" label={t("day")} required>
            <SelectInput id="ho-day" value={v.day} onChange={(e) => set("day", e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDate(`${d}T12:00:00${OFFSET}`, locale)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="ho-time" label={t("time")} required>
            <SelectInput id="ho-time" value={v.slot} onChange={(e) => set("slot", e.target.value)}>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id="ho-org" label={t("receiving")} required hint={t("receivingHint")}>
          <SelectInput id="ho-org" value={rel.assignment?.charityId} disabled aria-describedby="ho-org-hint">
            <option value={rel.assignment?.charityId}>{f.orgName(rel.assignment?.charityId)}</option>
          </SelectInput>
        </Field>
        <Field id="ho-by" label={t("handedBy")} required error={err("handedBy")}>
          <TextInput
            {...a11y("ho-by", "handedBy")}
            placeholder={t("handedByPlaceholder")}
            value={v.handedBy}
            onChange={(e) => set("handedBy", e.target.value)}
          />
        </Field>
        <p className="flex items-start gap-2 rounded-md bg-selected px-4 py-3 text-caption text-heading">
          <Icon name="info" size={16} className="mt-px shrink-0" />
          <span>{t("rule")}</span>
        </p>
      </Card>
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={submit}>
          {existing ? t("resubmit") : t("submit")}
        </Button>
        <ButtonLink fullWidth variant="ghost" href={`/field/tasks/${event.id}`}>
          {t("back")}
        </ButtonLink>
      </div>
    </div>
  );
}
