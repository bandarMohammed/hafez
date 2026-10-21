"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { can, eventRelations } from "@/domain/permissions";
import {
  FOOD_CONDITIONS,
  INSPECTION_OUTCOMES,
  NOT_SUITABLE_REASONS,
  NO_SURPLUS_REASONS,
  PACKAGING_CONDITIONS,
  QUANTITY_UNITS,
  SAFETY_ITEMS,
} from "@/domain/types";
import type {
  DemoDataset,
  DemoUser,
  HallEvent,
  Inspection,
  InspectionOutcome,
  OutcomeReason,
  SafetyItem,
} from "@/domain/types";
import { normalizeDigits } from "@/domain/newEvent";
import { saveInspection, validateInspection } from "@/domain/workflow/field";
import type { InspectionInput } from "@/domain/workflow/field";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow, RadioCards } from "@/components/ui/Choice";
import { Field, SelectInput, TextArea, TextInput, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFormatters } from "@/features/common/useFormatters";
import { TaskNotFound, useTask } from "./TaskDetail";

/** Figma E3 — inspection form. */
export function InspectionScreen({ eventId }: { eventId: string }) {
  const { user, data, event } = useTask(eventId);
  if (!user || !data) return null;
  if (!event) return <TaskNotFound />;
  const rel = eventRelations(data, event, user);
  const current = data.inspections.find(
    (i) => i.eventId === event.id && i.representativeId === user.id && i.status !== "final",
  );
  if (!can(user, "inspection.record", { kind: "event", event, rel }) || !current) return <TaskNotFound />;
  return <InspectionForm data={data} user={user} event={event} inspection={current} />;
}

function InspectionForm({
  data,
  event,
  inspection,
}: {
  data: DemoDataset;
  user: DemoUser;
  event: HallEvent;
  inspection: Inspection;
}) {
  const t = useTranslations("fieldScreens.inspect");
  const tr = useTranslations("field");
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const [v, setV] = useState({
    outcome: inspection.outcome as InspectionOutcome | null,
    qty: inspection.estimatedQuantity === null ? "" : String(inspection.estimatedQuantity),
    unit: inspection.unit ?? "kg",
    food: inspection.foodCondition ?? "",
    packaging: inspection.packagingCondition ?? "",
    checklist: inspection.safetyChecklist,
    reason: (inspection.reason ?? "") as OutcomeReason | "",
    notes: inspection.notes ?? "",
  });
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [k]: value }));

  const input = (): InspectionInput => {
    const q = normalizeDigits(v.qty).replace(/[٫,]/g, ".").trim();
    return {
      outcome: v.outcome,
      estimatedQuantity: q && /^\d+(\.\d+)?$/.test(q) ? Number(q) : null,
      unit: v.unit,
      foodCondition: (v.food || null) as InspectionInput["foodCondition"],
      packagingCondition: (v.packaging || null) as InspectionInput["packagingCondition"],
      safetyChecklist: v.checklist,
      reason: (v.reason || null) as OutcomeReason | null,
      notes: v.notes || null,
    };
  };
  const errors = attempted ? validateInspection(input()) : {};
  const err = (k: string) => (errors[k] ? t(`errors.${k}`) : undefined);

  const save = (mode: "draft" | "final") => {
    if (mode === "final") setAttempted(true);
    const r = dispatch((c) => saveInspection(c, event.id, input(), mode), {
      flashOn: mode === "draft" ? `/field/tasks/${event.id}/inspect` : undefined,
    });
    if (!r.ok || mode === "draft") return;
    // Final: surplus → handover (E4); no surplus / not suitable → documented result (E5).
    if (r.value === "inspected") router.push(`/field/tasks/${event.id}/handover`);
    else router.push(`/field/tasks/${event.id}/result`);
  };
  const reasons =
    v.outcome === "no_surplus" ? NO_SURPLUS_REASONS : v.outcome === "not_safe_to_collect" ? NOT_SUITABLE_REASONS : [];
  const toggle = (item: SafetyItem, on: boolean) =>
    set(
      "checklist",
      on ? SAFETY_ITEMS.filter((s) => s === item || v.checklist.includes(s)) : v.checklist.filter((s) => s !== item),
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: `/field/tasks/${event.id}`, label: t("back") }}
        title={t("title", { event: event.id })}
        subtitle={t("subtitle", { time: f.time(inspection.arrivedAt) })}
      />
      {attempted && Object.keys(errors).length ? (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-4 py-3 text-small text-danger">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>{t("notSaved")}</span>
        </div>
      ) : null}
      <Card className="flex flex-col gap-5 p-5">
        <RadioCards
          name="outcome"
          legend={t("outcome")}
          required
          value={v.outcome}
          onChange={(o) => setV((x) => ({ ...x, outcome: o, reason: "" }))}
          error={err("outcome")}
          errorId="insp-outcome-error"
          options={INSPECTION_OUTCOMES.map((o) => ({
            value: o,
            title: tr(`outcomes.${o}.title`),
            description: tr(`outcomes.${o}.description`),
          }))}
        />
        {v.outcome === "surplus_available" ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
              <Field
                id="insp-qty"
                label={t("estimatedNow")}
                required
                error={err("estimatedQuantity")}
                hint={t("estimatedHint")}
              >
                <TextInput
                  id="insp-qty"
                  inputMode="decimal"
                  value={v.qty}
                  invalid={Boolean(errors.estimatedQuantity)}
                  aria-describedby={describedBy("insp-qty", {
                    error: err("estimatedQuantity"),
                    hint: t("estimatedHint"),
                  })}
                  onChange={(e) => set("qty", e.target.value)}
                />
              </Field>
              <Field id="insp-unit" label={t("unit")} required>
                <SelectInput
                  id="insp-unit"
                  value={v.unit}
                  onChange={(e) => set("unit", e.target.value as typeof v.unit)}
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {tr(`units.${u}`)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <Field id="insp-food" label={t("foodCondition")} required error={err("foodCondition")}>
              <SelectInput
                id="insp-food"
                value={v.food}
                invalid={Boolean(errors.foodCondition)}
                aria-describedby={describedBy("insp-food", { error: err("foodCondition") })}
                onChange={(e) => set("food", e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {FOOD_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {tr(`foodConditions.${c}`)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="insp-pack" label={t("packaging")} required error={err("packagingCondition")}>
              <SelectInput
                id="insp-pack"
                value={v.packaging}
                invalid={Boolean(errors.packagingCondition)}
                aria-describedby={describedBy("insp-pack", { error: err("packagingCondition") })}
                onChange={(e) => set("packaging", e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {PACKAGING_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {tr(`packaging.${c}`)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </>
        ) : null}
        {reasons.length ? (
          <Field id="insp-reason" label={t("reason")} required error={err("reason")}>
            <SelectInput
              id="insp-reason"
              value={v.reason}
              invalid={Boolean(errors.reason)}
              aria-describedby={describedBy("insp-reason", { error: err("reason") })}
              onChange={(e) => set("reason", e.target.value as OutcomeReason)}
            >
              <option value="">{t("choose")}</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {tr(`reasons.${r}`)}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}
      </Card>
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-body-strong text-heading">{t("checklistTitle")}</h2>
        {SAFETY_ITEMS.map((s) => (
          <CheckboxRow key={s} checked={v.checklist.includes(s)} onChange={(on) => toggle(s, on)}>
            {t(`checklist.${s}`)}
          </CheckboxRow>
        ))}
        <Notice tone="warning">{t("checklistNote")}</Notice>
      </Card>
      <Card className="p-5">
        <Field id="insp-notes" label={t("notes")}>
          <TextArea id="insp-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </Card>
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={() => save("final")}>
          {v.outcome && v.outcome !== "surplus_available" ? t("saveClose") : t("saveContinue")}
        </Button>
        <Button fullWidth variant="ghost" onClick={() => save("draft")}>
          {t("saveDraft")}
        </Button>
      </div>
    </div>
  );
}
