import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Figma key–value rows ("القاعة · قاعة الواحة التجريبية"). Semantic <dl>; empty values show an en dash. */
export function DetailList({
  items,
  className,
  stacked,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode } | null | false>;
  className?: string;
  /** Label above value (mobile detail screens, Figma H2/D7) instead of side by side. */
  stacked?: boolean;
}) {
  return (
    <dl className={cn("flex flex-col", className)}>
      {items.filter(Boolean).map((row) => {
        const r = row as { label: string; value: ReactNode; hint?: ReactNode };
        return (
          <div
            key={r.label}
            className={cn(
              "border-b border-line py-3 last:border-b-0",
              stacked
                ? "flex flex-col gap-1"
                : "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
            )}
          >
            <dt className="text-small text-muted">{r.label}</dt>
            <dd className={cn("text-small-strong text-ink", !stacked && "sm:text-end")}>
              {r.value ?? "—"}
              {r.hint ? <span className="mt-1 block text-caption font-normal text-muted">{r.hint}</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
