"use client";

import { useTranslations } from "next-intl";
import type { ActivityLogEntry, DemoDataset } from "@/domain/types";
import { useFormatters } from "./useFormatters";

/** Figma "Activity Item" timeline: who did what, on which record, when, before → after (blueprint §5). */
export function ActivityList({
  data,
  entries,
  emptyText,
}: {
  data: DemoDataset;
  entries: ActivityLogEntry[];
  emptyText?: string;
}) {
  const t = useTranslations("hall.empty");
  const f = useFormatters(data);
  if (entries.length === 0) return <p className="text-small text-muted">{emptyText ?? t("noActivity")}</p>;
  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => (
        <li key={entry.id} className="flex gap-3">
          <span aria-hidden="true" className="flex w-5 flex-col items-center">
            <span className="mt-1.5 size-3 rounded-full bg-action" />
            {i < entries.length - 1 ? <span className="w-0.5 flex-1 bg-line" /> : null}
          </span>
          <div className="flex flex-col gap-1 pb-4">
            <p className="text-small-strong text-ink">{f.activitySummary(entry)}</p>
            <p className="text-caption text-muted">{f.statusChange(entry)}</p>
            <p className="tabular text-caption text-muted">
              <time dateTime={entry.timestamp}>{f.shortDateTime(entry.timestamp)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
