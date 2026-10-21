import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** Inline notice (Figma "Notice" frames): warning tone for demo/safety messages, info tone for hints. */
const TONES = {
  warning: "bg-warning-bg text-warning",
  info: "bg-selected text-heading",
} as const;

export function Notice({
  tone = "warning",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("flex items-start gap-2 rounded-md px-4 py-3 text-caption", TONES[tone], className)}>
      <Icon name="info" size={16} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}
