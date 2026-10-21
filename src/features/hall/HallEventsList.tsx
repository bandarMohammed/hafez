"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DemoDataset, DemoUser, HallEvent } from "@/domain/types";
import type { Locale } from "@/i18n/routing";
import { can } from "@/domain/permissions";
import { selectLatestActivityByEvent } from "@/domain/hall";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHallFormatters } from "./useHallFormatters";

interface Props {
  data: DemoDataset;
  user: DemoUser;
  events: HallEvent[];
}

/** Edit until a rep is assigned (rule in permissions/config), otherwise view-only. */
function useRowAction(user: DemoUser) {
  const t = useTranslations("hall.events");
  const locale = useLocale() as Locale;
  return (event: HallEvent) => {
    const name = `${event.title[locale]} · ${event.id}`;
    return can(user, "event.edit", { kind: "event", event })
      ? { href: `/hall/events/${event.id}/edit`, label: t("edit"), aria: t("editLabel", { event: name }) }
      : { href: `/hall/events/${event.id}`, label: t("view"), aria: t("viewLabel", { event: name }) };
  };
}

/** Figma C1 "Table Row" layout — used from 1280px (enough width beside the 280px sidebar). */
export function HallEventsTable({ data, user, events }: Props) {
  const t = useTranslations("hall.events");
  const f = useHallFormatters(data);
  const latest = selectLatestActivityByEvent(data);
  const action = useRowAction(user);

  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full border-collapse text-start">
        <caption className="sr-only">{t("title")}</caption>
        <thead>
          <tr className="bg-surface-alt text-small-strong text-muted">
            <th scope="col" className="px-6 py-3 text-start font-medium">
              {t("colEvent")}
            </th>
            <th scope="col" className="px-3 py-3 text-start font-medium">
              {t("colLastUpdate")}
            </th>
            <th scope="col" className="px-3 py-3 text-start font-medium">
              {t("colReady")}
            </th>
            <th scope="col" className="px-3 py-3 text-start font-medium">
              {t("colQuantity")}
            </th>
            <th scope="col" className="px-3 py-3 text-start font-medium">
              {t("colStatus")}
            </th>
            <th scope="col" className="w-0 px-4 py-3 text-start font-medium">
              <span className="sr-only">{t("colAction")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const last = latest.get(event.id);
            const a = action(event);
            return (
              <tr key={event.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="whitespace-nowrap px-6 py-4 text-start text-body-strong text-heading">
                  {event.title[f.locale]} · <bdi className="whitespace-nowrap">{event.id}</bdi>
                </th>
                <td className="px-3 py-4 text-small text-ink">
                  {last ? `${f.shortDateTime(last.timestamp)} — ${f.activityShort(last)}` : "—"}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-4 text-small text-ink">
                  {f.dateTime(event.foodReadyAt)}
                </td>
                <td className="px-3 py-4 text-small text-ink">
                  {f.quantity(
                    event,
                    data.handovers.find((h) => h.eventId === event.id),
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4">
                  <StatusBadge status={event.status} />
                </td>
                <td className="w-0 px-4 py-2 text-end">
                  <ButtonLink href={a.href} variant="ghost" aria-label={a.aria} className="px-3!">
                    {a.label}
                  </ButtonLink>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Below 1280px the table becomes cards (Figma "Event Card" pattern) — no horizontal scrolling on phones. */
export function HallEventsCards({ data, user, events }: Props) {
  const t = useTranslations("hall.events");
  const f = useHallFormatters(data);
  const latest = selectLatestActivityByEvent(data);
  const action = useRowAction(user);

  return (
    <ul className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 xl:hidden">
      {events.map((event) => {
        const last = latest.get(event.id);
        const a = action(event);
        return (
          <li key={event.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-body-strong text-heading">
                {event.title[f.locale]} · <bdi className="whitespace-nowrap">{event.id}</bdi>
              </h3>
              <StatusBadge status={event.status} />
            </div>
            <dl className="flex flex-col gap-2 text-small">
              <div className="flex items-start gap-2">
                <Icon name="time" size={18} className="mt-0.5 text-muted" />
                <dt className="sr-only">{t("colReady")}</dt>
                <dd className="tabular text-ink">{t("readyAt", { value: f.dateTime(event.foodReadyAt) })}</dd>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="weight" size={18} className="mt-0.5 text-muted" />
                <dt className="sr-only">{t("colQuantity")}</dt>
                <dd className="text-ink">
                  {f.quantity(
                    event,
                    data.handovers.find((h) => h.eventId === event.id),
                  )}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="listChecks" size={18} className="mt-0.5 text-muted" />
                <dt className="sr-only">{t("colLastUpdate")}</dt>
                <dd className="text-muted">
                  {last ? `${f.shortDateTime(last.timestamp)} — ${f.activityShort(last)}` : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-auto flex justify-end">
              <ButtonLink href={a.href} variant="secondary" aria-label={a.aria}>
                {a.label}
              </ButtonLink>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
