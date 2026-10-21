"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ActivityLogEntry, DemoDataset, Handover, HallEvent } from "@/domain/types";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatShortDate, formatTime } from "@/lib/format";
import { activityMessageKey, actorOrganizationName, quantityMessage } from "./presenters";

/** Locale-aware text for hall screens — keeps formatting rules out of the components. */
export function useHallFormatters(data: DemoDataset) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  const dateTime = (iso: string) =>
    t("common.dateTime", { date: formatDate(iso, locale), time: formatTime(iso, locale) });
  const shortDateTime = (iso: string) =>
    t("common.dateTime", { date: formatShortDate(iso, locale), time: formatTime(iso, locale) });

  const quantity = (event: HallEvent, handover: Handover | undefined) => {
    const q = quantityMessage(event, handover);
    return "value" in q ? t(`quantity.${q.key}`, { value: q.value }) : t(`quantity.${q.key}`);
  };

  const activitySummary = (entry: ActivityLogEntry) =>
    t(`activity.${activityMessageKey(entry.action)}`, {
      event: entry.entityId,
      actor: actorOrganizationName(data, entry, locale),
    });

  const activityShort = (entry: ActivityLogEntry) =>
    t(`activity.short.${activityMessageKey(entry.action)}`, {
      actor: actorOrganizationName(data, entry, locale),
      status: entry.after ? t(`status.${entry.after}`) : "",
    });

  const statusChange = (entry: ActivityLogEntry) => {
    const before = entry.before ? t(`status.${entry.before}`) : t("activity.noPrevious");
    const after = entry.after ? t(`status.${entry.after}`) : t("activity.noPrevious");
    return `${before} ${t("common.arrow")} ${after}`;
  };

  return { locale, dateTime, shortDateTime, quantity, activitySummary, activityShort, statusChange };
}
