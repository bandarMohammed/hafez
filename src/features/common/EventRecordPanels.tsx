"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { selectEventRecords } from "@/domain/selectors/event";
import type { DemoDataset } from "@/domain/types";
import { Panel } from "@/components/ui/Card";
import { DetailList } from "@/components/ui/DetailList";
import { useFormatters } from "./useFormatters";

type Records = ReturnType<typeof selectEventRecords>;

/**
 * Read-only panels describing an event's coordination, inspection and handover. Shared by the hall (C),
 * charity (D) and field (E) detail screens so a status change shows identically for every role.
 */
export function EventDetailsPanel({
  data,
  records,
  children,
}: {
  data: DemoDataset;
  records: Records;
  children?: ReactNode;
}) {
  const t = useTranslations("eventDetail");
  const tf = useTranslations("newEvent.foodTypes");
  const f = useFormatters(data);
  const e = records.event!;
  const hall = data.organizations.find((o) => o.id === e.hallId);
  return (
    <Panel title={t("detailsTitle")} titleId="ev-details">
      <DetailList
        items={[
          {
            label: t("hall"),
            value: `${f.orgName(e.hallId)} · ${[hall?.district?.[f.locale], hall?.city[f.locale]].filter(Boolean).join("، ")}`,
          },
          { label: t("eventDate"), value: f.date(e.eventDate) },
          e.endsAt ? { label: t("endsAt"), value: f.time(e.endsAt) } : null,
          { label: t("readyAt"), value: f.dateTime(e.foodReadyAt) },
          { label: t("guests"), value: f.n(e.expectedGuests), hint: t("guestsHint") },
          e.foodTypes?.length
            ? { label: t("foodTypes"), value: e.foodTypes.map((x) => tf(x)).join(f.locale === "ar" ? "، " : ", ") }
            : null,
          e.plannedQuantityKg ? { label: t("planned"), value: f.kg(e.plannedQuantityKg) } : null,
          {
            label: t("estimate"),
            value: e.expectedSurplusKg === null ? t("notEstimated") : f.kg(e.expectedSurplusKg),
            hint: e.expectedSurplusKg === null ? null : t("estimateHint"),
          },
          e.contactName ? { label: t("contact"), value: `${e.contactName} · ${e.contactPhone ?? ""}` } : null,
          e.notes ? { label: t("notes"), value: e.notes } : null,
        ]}
      />
      {children}
    </Panel>
  );
}

export function CoordinationPanel({ data, records }: { data: DemoDataset; records: Records }) {
  const t = useTranslations("eventDetail");
  const f = useFormatters(data);
  const { coordination, assignment } = records;
  return (
    <Panel title={t("coordinationTitle")} titleId="ev-coord">
      {!coordination ? (
        <p className="text-small text-muted">{t("noCoordination")}</p>
      ) : (
        <DetailList
          items={[
            { label: t("charity"), value: f.orgName(coordination.charityId) },
            { label: t("interestAt"), value: f.dateTime(coordination.createdAt) },
            assignment ? { label: t("representative"), value: f.userName(assignment.representativeId) } : null,
            assignment
              ? {
                  label: t("plannedArrival"),
                  value: f.dateTime(assignment.plannedArrivalAt),
                  hint: t("plannedArrivalHint"),
                }
              : { label: t("representative"), value: t("notAssigned") },
          ]}
        />
      )}
    </Panel>
  );
}

export function InspectionPanel({ data, records }: { data: DemoDataset; records: Records }) {
  const t = useTranslations("eventDetail");
  const tr = useTranslations("field");
  const f = useFormatters(data);
  const i = records.inspection;
  return (
    <Panel title={t("inspectionTitle")} titleId="ev-insp">
      {!i ? (
        <p className="text-small text-muted">{t("noInspection")}</p>
      ) : (
        <DetailList
          items={[
            { label: t("arrivedAt"), value: f.dateTime(i.arrivedAt) },
            {
              label: t("outcome"),
              value: i.status === "final" && i.outcome ? tr(`outcomes.${i.outcome}.title`) : t("inProgress"),
            },
            i.estimatedQuantity !== null && i.unit
              ? {
                  label: t("estimatedNow"),
                  value: `${f.n(i.estimatedQuantity)} ${tr(`units.${i.unit}`)}`,
                  hint: t("estimatedNowHint"),
                }
              : null,
            i.foodCondition ? { label: t("foodCondition"), value: tr(`foodConditions.${i.foodCondition}`) } : null,
            i.packagingCondition ? { label: t("packaging"), value: tr(`packaging.${i.packagingCondition}`) } : null,
            i.reason ? { label: t("reason"), value: tr(`reasons.${i.reason}`) } : null,
            i.status === "final" && i.outcome === "surplus_available"
              ? { label: t("checklist"), value: t("checklistCount", { done: i.safetyChecklist.length, total: 4 }) }
              : null,
            i.notes ? { label: t("notes"), value: i.notes } : null,
          ]}
        />
      )}
    </Panel>
  );
}

export function HandoverPanel({
  data,
  records,
  children,
}: {
  data: DemoDataset;
  records: Records;
  children?: ReactNode;
}) {
  const t = useTranslations("eventDetail");
  const tr = useTranslations("field");
  const f = useFormatters(data);
  const h = records.handover;
  const status = records.event?.status;
  return (
    <Panel title={t("handoverTitle")} titleId="ev-handover">
      {!h ? (
        <p className="text-small text-muted">
          {status === "no_surplus"
            ? t("noHandoverNoSurplus")
            : status === "not_collectable"
              ? t("noHandoverNotCollectable")
              : t("noHandover")}
        </p>
      ) : (
        <>
          <DetailList
            items={[
              { label: t("actual"), value: `${f.n(h.actualQuantity)} ${tr(`units.${h.unit}`)}`, hint: t("actualHint") },
              h.foodTypesText ? { label: t("foodTypes"), value: h.foodTypesText } : null,
              { label: t("handedOverAt"), value: f.dateTime(h.handedOverAt) },
              h.handedBy ? { label: t("handedBy"), value: h.handedBy } : null,
              { label: t("receiving"), value: f.orgName(h.receivingOrganizationId) },
              {
                label: t("charityConfirm"),
                value: h.charityConfirmedAt
                  ? t("confirmedAt", { at: f.dateTime(h.charityConfirmedAt) })
                  : t("pendingRequired"),
              },
              {
                label: t("hallConfirm"),
                value: h.hallConfirmedAt
                  ? t("confirmedAt", { at: f.dateTime(h.hallConfirmedAt) })
                  : t("pendingOptional"),
              },
              h.dispute ? { label: t("dispute"), value: h.dispute.note } : null,
            ]}
          />
          {children}
        </>
      )}
    </Panel>
  );
}
