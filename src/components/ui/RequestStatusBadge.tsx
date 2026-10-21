import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Figma component "Request Status" (13 variants) for beneficiary requests, surplus reports and food listings.
 * The label is always shown — colour is never the only signal.
 */
const TONE = {
  pending: "bg-warning-bg text-warning",
  needs_info: "bg-info-bg text-info",
  accepted: "bg-info-bg text-info",
  ready: "bg-selected text-heading",
  completed: "bg-success-bg text-success",
  coordinated: "bg-success-bg text-success",
  partial: "bg-warning-bg text-warning",
  not_received: "bg-danger-bg text-danger",
  rejected: "bg-danger-bg text-danger",
  cancelled: "bg-surface-alt text-muted",
  available: "bg-success-bg text-success",
  low: "bg-warning-bg text-warning",
  sold_out: "bg-surface-alt text-muted",
  ended: "bg-surface-alt text-muted",
} as const;

export type RequestStatusKey = keyof typeof TONE;

export function RequestStatusBadge({ status, className }: { status: RequestStatusKey; className?: string }) {
  const t = useTranslations("requestStatus");
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
