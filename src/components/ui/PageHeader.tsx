import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Screen header used by every workspace page (Figma: breadcrumb caption, H2 title, small subtitle,
 * primary actions on the end side). On mobile-first screens a back link replaces the breadcrumb (Figma D/E/H).
 */
export function PageHeader({
  crumbs,
  back,
  title,
  badge,
  subtitle,
  actions,
  className,
}: {
  crumbs?: string;
  back?: { href: string; label: string };
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex w-fit items-center gap-1 text-small-strong text-action hover:text-action-hover"
          >
            <Icon name="chevronBack" size={18} />
            {back.label}
          </Link>
        ) : crumbs ? (
          <p className="text-caption text-muted">{crumbs}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h3 text-heading md:text-h2">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="text-small text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
    </header>
  );
}
