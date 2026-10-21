"use client";

import { useTranslations } from "next-intl";
import type { ActivityLogEntry, DemoDataset } from "@/domain/types";
import { Panel } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useHallFormatters } from "./useHallFormatters";

/** Figma C1 "What this role can't do" — the hall manager's limits from blueprint §2. */
export function HallRulesPanel() {
  const t = useTranslations("hall.rules");
  const rules = ["otherHalls", "confirmForCharity", "editAfterAssign"] as const;
  return (
    <Panel title={t("title")} titleId="hall-rules">
      <ul className="flex flex-col gap-3">
        {rules.map((rule) => (
          <li key={rule} className="flex items-start gap-2 text-small text-ink">
            <Icon name="lock" size={18} className="mt-0.5 text-muted" />
            {t(rule)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Figma "Activity Item" timeline: who did what, on which record, when, before → after (blueprint §5). */
export function HallActivityPanel({ data, entries }: { data: DemoDataset; entries: ActivityLogEntry[] }) {
  const t = useTranslations("hall");
  const f = useHallFormatters(data);
  return (
    <Panel title={t("activityTitle")} titleId="hall-activity">
      {entries.length === 0 ? (
        <p className="text-small text-muted">{t("empty.noActivity")}</p>
      ) : (
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
      )}
    </Panel>
  );
}
