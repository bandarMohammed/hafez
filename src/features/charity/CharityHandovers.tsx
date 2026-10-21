"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { selectCharityHandovers } from "@/domain/selectors/charity";
import type { DemoDataset, DemoUser, Handover } from "@/domain/types";
import { confirmHandoverByCharity, disputeHandover } from "@/domain/workflow/charity";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailList } from "@/components/ui/DetailList";
import { Field, TextArea, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useFormatters } from "@/features/common/useFormatters";
import { useCharity } from "./Opportunities";

/** Figma D5 list — handovers received by this charity. */
export function CharityHandoversScreen() {
  const { user, data } = useCharity();
  if (!user || !data) return null;
  return <HandoversList data={data} user={user} />;
}

function HandoversList({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("charity.handovers");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const { pending, confirmed } = selectCharityHandovers(data, user.organizationId!);
  const item = (h: Handover) => {
    const e = data.events.find((x) => x.id === h.eventId)!;
    return (
      <li key={h.id}>
        <RecordCard
          href={`/charity/handovers/${h.id}`}
          highlight={e.status === "inspected"}
          title={
            <>
              {e.title[locale]} · <bdi>{e.id}</bdi>
            </>
          }
          badge={<StatusBadge status={e.status} />}
          meta={[
            { icon: "weight", text: t("actual", { qty: f.kg(h.actualQuantity) }) },
            { icon: "time", text: f.dateTime(h.handedOverAt) },
            { icon: "charities", text: f.userName(h.recordedBy) },
            h.dispute ? { icon: "alert", text: t("disputed") } : null,
          ]}
        />
      </li>
    );
  };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader className="mb-0" crumbs={t("crumbs")} title={t("title")} subtitle={t("subtitle")} />
      <section aria-labelledby="ho-pending" className="flex flex-col gap-3">
        <h2 id="ho-pending" className="text-h4 text-heading">
          {t("pending")} <span className="text-muted">({f.n(pending.length)})</span>
        </h2>
        {pending.length === 0 ? (
          <Card>
            <StateMessage icon="pickup" title={t("pendingEmpty")} body={t("pendingEmptyBody")} />
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">{pending.map(item)}</ul>
        )}
      </section>
      <section aria-labelledby="ho-done" className="flex flex-col gap-3">
        <h2 id="ho-done" className="text-h4 text-heading">
          {t("confirmed")} <span className="text-muted">({f.n(confirmed.length)})</span>
        </h2>
        {confirmed.length ? (
          <ul className="grid gap-4 md:grid-cols-2">{confirmed.map(item)}</ul>
        ) : (
          <p className="text-small text-muted">{t("confirmedEmpty")}</p>
        )}
      </section>
    </div>
  );
}

/** Figma D5 — review the provisional handover, then confirm charity receipt (completes «تم الاستلام»). */
export function CharityHandoverDetail({ handoverId }: { handoverId: string }) {
  const t = useTranslations("charity.handovers");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const handover = data.handovers.find((h) => h.id === handoverId && h.receivingOrganizationId === user.organizationId);
  const event = handover && data.events.find((e) => e.id === handover.eventId);
  if (!handover || !event) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/charity/handovers">{t("back")}</ButtonLink>}
      />
    );
  }
  return <HandoverReview data={data} user={user} handover={handover} />;
}

function HandoverReview({ data, user, handover }: { data: DemoDataset; user: DemoUser; handover: Handover }) {
  const t = useTranslations("charity.handovers");
  const tu = useTranslations("field.units");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const event = data.events.find((e) => e.id === handover.eventId)!;
  const inspection = data.inspections.find((i) => i.id === handover.inspectionId);
  const canConfirm = can(user, "handover.confirm_charity", { kind: "handover", handover, event });
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const r = dispatch((c) => confirmHandoverByCharity(c, handover.id), { flashOn: "/charity/handovers" });
    if (r.ok) router.push("/charity/handovers");
  };
  const dispute = () => {
    const r = dispatch((c) => disputeHandover(c, handover.id, note), { flashOn: "/charity/handovers" });
    if (r.ok) router.push("/charity/handovers");
    else setError(t("noteRequired"));
  };

  const step = (done: boolean, label: string) => (
    <li className="flex items-center gap-2 text-small">
      <Icon name={done ? "check" : "time"} size={18} className={done ? "text-success" : "text-muted"} />
      <span className={done ? "text-ink" : "text-muted"}>{label}</span>
    </li>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/handovers", label: t("back") }}
        title={t("detailTitle", { event: event.id })}
        badge={<StatusBadge status={event.status} />}
        subtitle={canConfirm ? t("detailSubtitle", { rep: f.userName(handover.recordedBy) }) : event.title[locale]}
      />
      {handover.dispute ? (
        <p className="rounded-md bg-warning-bg px-4 py-3 text-small text-warning">
          {t("disputeOpen", { note: handover.dispute.note })}
        </p>
      ) : null}
      <Card className="p-5">
        <DetailList
          items={[
            {
              label: t("fields.actual"),
              value: f.n(handover.actualQuantity) + " " + tu(handover.unit),
              hint: t("fields.actualHint"),
            },
            { label: t("fields.unit"), value: tu(handover.unit) },
            handover.foodTypesText ? { label: t("fields.foodTypes"), value: handover.foodTypesText } : null,
            { label: t("fields.time"), value: f.dateTime(handover.handedOverAt) },
            { label: t("fields.by"), value: f.userName(handover.recordedBy) },
            handover.handedBy ? { label: t("fields.handedBy"), value: handover.handedBy } : null,
            { label: t("fields.receiving"), value: f.orgName(handover.receivingOrganizationId) },
            inspection
              ? {
                  label: t("fields.checklist"),
                  value: t("fields.checklistValue", { done: inspection.safetyChecklist.length, total: 4 }),
                }
              : null,
          ]}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-body-strong text-heading">{t("confirmations")}</h2>
        <ul className="flex flex-col gap-2">
          {step(
            Boolean(handover.charityConfirmedAt),
            handover.charityConfirmedAt ? t("charityDone") : t("charityRequired"),
          )}
          {step(
            Boolean(handover.hallConfirmedAt),
            handover.hallConfirmedAt
              ? t("hallDone", { hall: f.orgName(event.hallId) })
              : t("hallOptional", { hall: f.orgName(event.hallId) }),
          )}
          {step(true, t("repDone"))}
        </ul>
      </Card>
      {canConfirm ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <Button onClick={confirm}>{t("confirm")}</Button>
            <Button
              variant="ghost"
              aria-expanded={disputeOpen}
              aria-controls="dispute-panel"
              onClick={() => setDisputeOpen((o) => !o)}
            >
              {t("disputeToggle")}
            </Button>
          </div>
          {disputeOpen ? (
            <Card className="flex flex-col gap-3 p-5" id="dispute-panel">
              <Field id="dispute-note" label={t("disputeLabel")} required error={error ?? undefined}>
                <TextArea
                  id="dispute-note"
                  value={note}
                  invalid={Boolean(error)}
                  aria-describedby={describedBy("dispute-note", { error: error ?? undefined })}
                  placeholder={t("disputePlaceholder")}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setError(null);
                  }}
                />
              </Field>
              <Button variant="secondary" className="sm:w-fit" onClick={dispute}>
                {t("disputeSend")}
              </Button>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
