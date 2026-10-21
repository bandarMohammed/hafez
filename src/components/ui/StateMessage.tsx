import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import type { IconKey } from "./Icon";

/**
 * Figma "Empty State" pattern, reused for empty / error / no-permission / under-development states
 * (Figma G1–G3, F2). Tone only changes the icon box colours.
 */
const TONES = {
  neutral: "bg-surface-alt text-heading",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
} as const;

interface StateMessageProps {
  icon: IconKey;
  title: string;
  body?: string;
  tone?: keyof typeof TONES;
  badge?: string;
  actions?: ReactNode;
  /** Renders the title as h1 when the message is the whole page. */
  asPage?: boolean;
  className?: string;
}

export function StateMessage({
  icon,
  title,
  body,
  tone = "neutral",
  badge,
  actions,
  asPage,
  className,
}: StateMessageProps) {
  const Heading = asPage ? "h1" : "h2";
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span className={cn("mb-1 inline-flex size-16 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon name={icon} size={28} />
      </span>
      {badge ? <span className="rounded-full bg-warning-bg px-3 py-1 text-caption text-warning">{badge}</span> : null}
      <Heading className="text-h4 text-heading">{title}</Heading>
      {body ? <p className="text-small text-muted">{body}</p> : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
