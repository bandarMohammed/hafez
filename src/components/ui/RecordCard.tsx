import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import type { IconKey } from "./Icon";

/**
 * Figma "Event Card" / "Food Card": title with the record code at the end, a status badge, icon meta rows
 * and optional actions. When `href` is set the title is the link (one tab stop per card).
 */
export function RecordCard({
  title,
  badge,
  meta,
  href,
  children,
  highlight,
  className,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: Array<{ icon: IconKey; text: ReactNode } | null | false>;
  href?: string;
  children?: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card",
        highlight ? "border-[1.5px] border-action" : "border-line",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-body-strong text-heading">
          {href ? (
            <Link href={href} className="hover:text-action after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {meta?.length ? (
        <ul className="flex flex-col gap-2">
          {meta.filter(Boolean).map((m, i) => {
            const row = m as { icon: IconKey; text: ReactNode };
            return (
              <li key={i} className="flex items-start gap-2 text-small text-muted">
                <Icon name={row.icon} size={18} className="mt-0.5" />
                <span className="min-w-0">{row.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {children ? <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div> : null}
    </article>
  );
}
