"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ActivityLogEntry, DemoDataset, Handover, HallEvent } from "@/domain/types";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatShortDate, formatTime } from "@/lib/format";
import { activityMessageKey, quantityMessage } from "@/features/hall/presenters";

/** Event statuses use `status.*`; request/report/listing statuses use `requestStatus.*`. */
const statusNamespace = (entry: Pick<ActivityLogEntry, "entityType">) =>
  entry.entityType === "event" ? "status" : "requestStatus";

/**
 * Locale-aware text shared by every role screen: dates (Gregorian, Latin digits, Asia/Riyadh), kg, names
 * of organisations / team members / pseudonymous beneficiaries, and activity log lines.
 */
export function useFormatters(data: DemoDataset) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const n = (v: number) => formatNumber(v, locale);
  const kg = (v: number) => t("common.kg", { value: n(v) });
  const date = (iso: string) => formatDate(iso, locale);
  const time = (iso: string) => formatTime(iso, locale);
  const dateTime = (iso: string) =>
    t("common.dateTime", { date: formatDate(iso, locale), time: formatTime(iso, locale) });
  const shortDateTime = (iso: string) =>
    t("common.dateTime", { date: formatShortDate(iso, locale), time: formatTime(iso, locale) });

  /** "13:00–16:00" kept left-to-right inside Arabic text (Unicode isolates stop the bidi reordering). */
  const LRI = String.fromCharCode(0x2066);
  const PDI = String.fromCharCode(0x2069);
  const timeRange = (startIso: string, endIso: string) => `${LRI}${time(startIso)}–${time(endIso)}${PDI}`;

  const orgName = (id: string | null | undefined) =>
    (id && data.organizations.find((o) => o.id === id)?.name[locale]) || "—";

  /** Team members show their display name; beneficiaries only their pseudonym (Figma D6/D7). */
  const userName = (id: string | null | undefined) => {
    const u = id ? data.users.find((x) => x.id === id) : undefined;
    if (!u) return "—";
    if (u.role === "beneficiary") return t("common.pseudonym", { code: u.pseudonym ?? "—" });
    return u.displayName?.[locale] ?? t(`roles.${u.role}.name`);
  };

  /** Who acted, as shown in logs: the organisation for staff, the pseudonym for beneficiaries. */
  const actorName = (entry: ActivityLogEntry) => {
    const u = data.users.find((x) => x.id === entry.actorUserId);
    if (!u) return entry.actorUserId;
    if (u.role === "beneficiary") return userName(u.id);
    return u.organizationId ? orgName(u.organizationId) : userName(u.id);
  };

  const quantity = (event: HallEvent, handover: Handover | undefined) => {
    const q = quantityMessage(event, handover);
    return "value" in q ? t(`quantity.${q.key}`, { value: n(q.value) }) : t(`quantity.${q.key}`);
  };

  const statusLabel = (entry: Pick<ActivityLogEntry, "entityType">, status: string | null) =>
    status ? t(`${statusNamespace(entry)}.${status}`) : t("activity.noPrevious");

  const activitySummary = (entry: ActivityLogEntry) =>
    t(`activity.${activityMessageKey(entry.action)}`, { event: entry.entityId, actor: actorName(entry) });

  const activityShort = (entry: ActivityLogEntry) =>
    t(`activity.short.${activityMessageKey(entry.action)}`, {
      actor: actorName(entry),
      status: entry.after ? statusLabel(entry, entry.after) : "",
    });

  const statusChange = (entry: ActivityLogEntry) =>
    entry.before === entry.after
      ? statusLabel(entry, entry.after)
      : `${statusLabel(entry, entry.before)} ${t("common.arrow")} ${statusLabel(entry, entry.after)}`;

  return {
    locale,
    n,
    kg,
    date,
    time,
    dateTime,
    shortDateTime,
    timeRange,
    orgName,
    userName,
    actorName,
    quantity,
    statusLabel,
    activitySummary,
    activityShort,
    statusChange,
  };
}
