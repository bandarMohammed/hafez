"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useCurrentUser, useDemoStore } from "@/data/store";
import {
  NEW_EVENT_FIELDS,
  emptyNewEventValues,
  eventDateOptions,
  valuesFromEvent,
  timeSlots,
  validateNewEvent,
} from "@/domain/newEvent";
import type { NewEventError, NewEventErrors, NewEventField, NewEventValues, SaveMode } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { HallEvent } from "@/domain/types";
import { updateEvent } from "@/domain/workflow/hall";
import { formatDate } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SelectInput, TextInput, UnitInput, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import { FoodTypePicker } from "./FoodTypePicker";

const cfg = DEMO_CONFIG.newEvent;
const fieldId = (f: NewEventField | "location") => `ne-${f}`;

/**
 * Figma C2 — register a new event (frames 19:1462 AR error state / 19:1689 EN valid state).
 * With `editEvent` the same form edits an event before pickup (blueprint §2, Q6) — same fields and rules.
 */
export function NewEventForm({ editEvent }: { editEvent?: HallEvent } = {}) {
  const t = useTranslations("newEvent");
  const tEdit = useTranslations("editEvent");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const createEvent = useDemoStore((s) => s.createEvent);
  const dispatch = useDemoStore((s) => s.dispatch);

  const [values, setValues] = useState<NewEventValues>(() =>
    editEvent
      ? { ...valuesFromEvent(editEvent, locale), contactName: editEvent.contactName || t("defaultContact") }
      : emptyNewEventValues(t("defaultContact")),
  );
  const [attempted, setAttempted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  // Options are computed once per visit: "today" in Asia/Riyadh … +N days.
  const [now] = useState(() => new Date());
  // Editing keeps the stored event date selectable even when it is outside the booking window.
  const initialDate = editEvent ? valuesFromEvent(editEvent, "en").date : null;
  const dateOptions = useMemo(() => {
    const opts = eventDateOptions(now);
    return initialDate && !opts.includes(initialDate) ? [initialDate, ...opts] : opts;
  }, [now, initialDate]);
  const slots = useMemo(() => timeSlots(), []);

  const hall = data?.organizations.find((o) => o.id === user?.organizationId);
  if (!user || !hall) return null;
  if (editEvent && !can(user, "event.edit", { kind: "event", event: editEvent })) {
    return (
      <StateMessage
        asPage
        icon="lock"
        tone="info"
        title={tEdit("lockedTitle", { event: editEvent.id })}
        body={tEdit("lockedBody")}
        actions={<ButtonLink href={`/hall/events/${editEvent.id}`}>{tEdit("backToDetail")}</ButtonLink>}
      />
    );
  }
  if (!editEvent && !can(user, "event.create")) {
    return <StateMessage asPage icon="lock" tone="danger" title={t("notAllowed")} />;
  }

  // Errors appear after the first save attempt and then update live as fields are corrected.
  const result = validateNewEvent(values, now);
  const errors: NewEventErrors = attempted && !result.ok ? result.errors : {};
  const invalidFields = NEW_EVENT_FIELDS.filter((f) => errors[f]);

  const set = <K extends keyof NewEventValues>(key: K, value: NewEventValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const errorText = (field: NewEventField, code: NewEventError | undefined) => {
    if (!code) return undefined;
    const specific = `errors.${field}_${code}`;
    if (t.has(specific)) return t(specific);
    switch (code) {
      case "titleLength":
        return t("errors.titleLength", cfg.titleLength);
      case "guestsRange":
        return t("errors.guestsRange", cfg.guests);
      case "quantityRange":
        return t("errors.quantityRange", cfg.plannedQuantityKg);
      case "tooLong":
        return t("errors.tooLong", {
          max: field === "notes" ? cfg.notesMaxLength : cfg.contactNameMaxLength,
        });
      default:
        return t(`errors.${code}`);
    }
  };

  const hint = (field: NewEventField) => (t.has(`hints.${field}`) ? t(`hints.${field}`) : undefined);
  const a11y = (field: NewEventField) => ({
    id: fieldId(field),
    invalid: Boolean(errors[field]),
    "aria-describedby": describedBy(fieldId(field), { hint: hint(field), error: errors[field] }),
  });
  const fieldProps = (field: NewEventField, required = true) => ({
    id: fieldId(field),
    label: t(`fields.${field}`),
    required,
    hint: hint(field),
    error: errorText(field, errors[field]),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode: SaveMode = submitter?.value === "registered" ? "registered" : "forecast";
    setAttempted(true);
    if (!result.ok) {
      setSummaryOpen(true);
      // Move focus to the summary so keyboard and screen-reader users hear what to fix.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (editEvent) {
      const r = dispatch((c) => updateEvent(c, editEvent.id, result.data), { flashOn: `/hall/events/${editEvent.id}` });
      if (r.ok) router.push(`/hall/events/${editEvent.id}`);
      return;
    }
    const id = createEvent(result.data, mode);
    if (!id) return;
    // Figma prototype: "Save & make available" → C3 forecast; "Save as registered" → C1.
    router.push(mode === "forecast" ? `/hall/events/${id}/forecast` : "/hall");
  };

  const fieldList = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    invalidFields.map((f) => t(`fields.${f}`)),
  );
  const onlyRequired = invalidFields.every((f) => errors[f] === "required");
  const location = [hall.city[locale], hall.district?.[locale]].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-caption text-muted">{editEvent ? tEdit("crumbs", { event: editEvent.id }) : t("crumbs")}</p>
        <h1 className="text-h2 text-heading">{editEvent ? tEdit("title", { event: editEvent.id }) : t("title")}</h1>
        <p className="text-small text-muted">{editEvent ? tEdit("subtitle") : t("subtitle")}</p>
      </header>

      {summaryOpen && invalidFields.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="group"
          aria-labelledby="ne-summary-title"
          aria-describedby="ne-summary-body"
          className="flex items-start gap-3 rounded-lg border border-line bg-surface p-5 shadow-card"
        >
          <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-danger" />
          <Icon name="alert" size={24} className="shrink-0 text-danger" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p id="ne-summary-title" className="text-body-strong text-heading">
              {t("summary.title")}
            </p>
            <p id="ne-summary-body" className="text-small text-muted">
              {t(onlyRequired ? "summary.requiredOnly" : "summary.mixed", {
                count: invalidFields.length,
                fields: fieldList,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSummaryOpen(false)}
            aria-label={t("summary.dismiss")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-selected"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-6">
          <form noValidate onSubmit={onSubmit} aria-labelledby="ne-section" className="flex flex-col gap-6">
            <h2 id="ne-section" className="text-h4 text-heading">
              {t("sectionTitle")}
            </h2>

            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field {...fieldProps("title")}>
                <TextInput
                  {...a11y("title")}
                  value={values.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={t("placeholders.title")}
                  maxLength={cfg.titleLength.max + 20}
                  autoComplete="off"
                  required
                />
              </Field>

              <Field {...fieldProps("date")}>
                <SelectInput
                  {...a11y("date")}
                  value={values.date}
                  onChange={(e) => set("date", e.target.value)}
                  required
                >
                  <option value="">{t("placeholders.date")}</option>
                  {dateOptions.map((d) => (
                    <option key={d} value={d}>
                      {formatDate(`${d}T12:00:00${cfg.utcOffset}`, locale)}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field id={fieldId("location")} label={t("fields.location")} required hint={t("hints.location")}>
                <SelectInput
                  id={fieldId("location")}
                  aria-describedby={`${fieldId("location")}-hint`}
                  defaultValue={hall.id}
                >
                  <option value={hall.id}>{location}</option>
                </SelectInput>
              </Field>

              <Field {...fieldProps("guests")}>
                <TextInput
                  {...a11y("guests")}
                  value={values.guests}
                  onChange={(e) => set("guests", e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field {...fieldProps("endTime")}>
                <SelectInput
                  {...a11y("endTime")}
                  value={values.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  required
                >
                  <option value="">{t("placeholders.time")}</option>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field {...fieldProps("readyTime")}>
                <SelectInput
                  {...a11y("readyTime")}
                  value={values.readyTime}
                  onChange={(e) => set("readyTime", e.target.value)}
                  required
                >
                  <option value="">{t("placeholders.time")}</option>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field {...fieldProps("foodTypes")} labelId="ne-foodTypes-label">
                <FoodTypePicker
                  id={fieldId("foodTypes")}
                  labelId="ne-foodTypes-label"
                  value={values.foodTypes}
                  onChange={(next) => set("foodTypes", next)}
                  invalid={Boolean(errors.foodTypes)}
                  describedById={describedBy(fieldId("foodTypes"), { error: errors.foodTypes })}
                />
              </Field>

              <Field {...fieldProps("plannedKg")}>
                <UnitInput
                  {...a11y("plannedKg")}
                  unit={t("kgUnit")}
                  value={values.plannedKg}
                  onChange={(e) => set("plannedKg", e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field {...fieldProps("contactName")}>
                <TextInput
                  {...a11y("contactName")}
                  value={values.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>

              <Field {...fieldProps("contactPhone")}>
                <TextInput
                  {...a11y("contactPhone")}
                  value={values.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  placeholder={t("placeholders.contactPhone")}
                  inputMode="tel"
                  dir="ltr"
                  className="rtl:text-right"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field {...fieldProps("notes", false)} className="md:col-span-2">
                <TextInput
                  {...a11y("notes")}
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder={t("placeholders.notes")}
                  autoComplete="off"
                />
              </Field>
            </div>

            {/* DOM order = primary first (mobile top, default for Enter); row-reverse gives Figma's visual order. */}
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:flex-wrap sm:justify-start">
              {editEvent ? (
                <>
                  <Button type="submit" name="mode" value="save">
                    {tEdit("save")}
                  </Button>
                  <ButtonLink href={`/hall/events/${editEvent.id}`} variant="ghost">
                    {t("actions.cancel")}
                  </ButtonLink>
                </>
              ) : (
                <>
                  <Button type="submit" name="mode" value="forecast">
                    {t("actions.available")}
                  </Button>
                  <Button type="submit" name="mode" value="registered" variant="secondary">
                    {t("actions.registered")}
                  </Button>
                  <ButtonLink href="/hall" variant="ghost">
                    {t("actions.cancel")}
                  </ButtonLink>
                </>
              )}
            </div>
          </form>
        </Card>

        <aside aria-labelledby="ne-after" className="rounded-lg border border-line bg-surface p-6">
          <h2 id="ne-after" className="mb-4 text-h4 text-heading">
            {editEvent ? tEdit("after.title") : t("after.title")}
          </h2>
          <ol className="flex flex-col gap-4 text-small text-ink">
            {editEvent ? (
              <>
                <li>{tEdit("after.step1")}</li>
                <li>{tEdit("after.step2")}</li>
              </>
            ) : (
              <>
                <li>{t("after.step1")}</li>
                <li>{t("after.step2")}</li>
                <li>{t("after.step3")}</li>
              </>
            )}
          </ol>
          <p className="mt-5 flex items-start gap-2 rounded-md bg-selected px-4 py-3 text-caption text-heading">
            <Icon name="info" size={16} className="mt-px shrink-0" />
            <span>{t("after.note")}</span>
          </p>
        </aside>
      </div>
    </div>
  );
}
