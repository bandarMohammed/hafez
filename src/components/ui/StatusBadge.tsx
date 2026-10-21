import { useTranslations } from "next-intl";
import type { EventStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Figma "Status Badge" — one variant per EventStatus. Label is always shown (colour is never the only signal).
 * "No surplus" is neutral (not an error) per blueprint; "Not collectable" uses danger.
 */
const TONE: Record<EventStatus, string> = {
  registered: "bg-surface-alt text-muted",
  available: "bg-info-bg text-info",
  awaiting_charity: "bg-warning-bg text-warning",
  assigned: "bg-info-bg text-info",
  representative_arrived: "bg-selected text-heading",
  inspected: "bg-selected text-heading",
  collected: "bg-success-bg text-success",
  no_surplus: "bg-surface-alt text-ink",
  not_collectable: "bg-danger-bg text-danger",
  closed: "bg-disabled text-ink",
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-small-strong whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
