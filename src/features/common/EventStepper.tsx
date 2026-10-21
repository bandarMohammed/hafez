"use client";

import { useTranslations } from "next-intl";
import type { EventStatus } from "@/domain/types";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/** Figma D4 / B2 "مسار المناسبة": registration → … → closing. */
const STEPS = [
  "registered",
  "available",
  "interest",
  "assigned",
  "arrived",
  "inspected",
  "handover",
  "closed",
] as const;

/** How many steps are complete for a status (the next one is the current step). */
const DONE: Record<EventStatus, number> = {
  registered: 1,
  available: 2,
  awaiting_charity: 3,
  assigned: 4,
  representative_arrived: 5,
  inspected: 6,
  collected: 7,
  no_surplus: 6,
  not_collectable: 6,
  closed: 8,
};

export function EventStepper({ status }: { status: EventStatus }) {
  const t = useTranslations("stepper");
  const done = DONE[status];
  // A visit without surplus ends after the inspection: handover/closing don't apply (UC-08).
  const ended = status === "no_surplus" || status === "not_collectable";
  return (
    <section aria-labelledby="stepper-title" className="rounded-lg border border-line bg-surface p-6">
      <h2 id="stepper-title" className="mb-5 text-h4 text-heading">
        {t("title")}
      </h2>
      <ol className="grid grid-cols-4 gap-x-2 gap-y-5 md:grid-cols-8">
        {STEPS.map((step, i) => {
          const isDone = i < done;
          const isCurrent = !ended && i === done;
          const skipped = ended && i >= done;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full border-2 text-small-strong",
                  isDone && "border-action bg-action text-on-action",
                  isCurrent && "border-action bg-selected text-heading",
                  !isDone && !isCurrent && "border-line-strong bg-surface text-muted",
                  skipped && "border-dashed",
                )}
              >
                {isDone ? <Icon name="check" size={18} /> : i + 1}
              </span>
              <span className={cn("text-caption", isCurrent ? "font-bold text-heading" : "text-muted")}>
                {t(step)}
                {isDone ? <span className="sr-only"> ({t("done")})</span> : null}
                {skipped ? <span className="sr-only"> ({t("notApplicable")})</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {ended ? (
        <p className="mt-4 text-caption text-muted">{t("endedAfterInspection", { status: t(`end_${status}`) })}</p>
      ) : null}
    </section>
  );
}
