"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import type { NavItem } from "@/domain/roles";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

/**
 * Figma "Sidebar" on the Forest surface with "Nav Item" (Default/Active). Only items allowed for the current
 * role are rendered (they come from ROLE_CONFIG). Unbuilt screens get a gold dot + legend (and screen-reader text).
 */
export function Sidebar({
  items,
  labelNamespace,
  onNavigate,
}: {
  items: NavItem[];
  labelNamespace: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const org = user?.organizationId ? data?.organizations.find((o) => o.id === user.organizationId) : undefined;

  return (
    <div className="flex h-full flex-col bg-inverse px-4 py-6 text-on-inverse">
      <div className="px-2">
        <Logo locale={locale} tone="reverse" width={140} />
      </div>
      <nav aria-label={t("common.mainNav")} className="mt-6 flex-1">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href || (item.activePattern ? new RegExp(item.activePattern).test(pathname) : false);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-md px-4 py-2 transition-colors",
                    active ? "bg-inverse-raised text-body-strong" : "text-body hover:bg-inverse-raised/60",
                  )}
                >
                  {active ? (
                    <span aria-hidden="true" className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-sprout" />
                  ) : null}
                  <Icon name={item.icon} className={active ? "text-accent-on-inverse" : "text-on-inverse"} />
                  <span className="flex-1 truncate">{t(`${labelNamespace}.${item.key}`)}</span>
                  {!item.implemented ? (
                    <>
                      <span
                        aria-hidden="true"
                        data-unbuilt
                        className="size-2 shrink-0 rounded-full bg-gold-on-inverse"
                      />
                      <span className="sr-only">({t("picker.underDevelopment")})</span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {items.some((item) => !item.implemented) ? (
          <p aria-hidden="true" className="mt-4 flex items-center gap-2 px-4 text-caption text-on-inverse/70">
            <span className="size-2 shrink-0 rounded-full bg-gold-on-inverse" />
            {t("common.navUnbuiltLegend")}
          </p>
        ) : null}
      </nav>
      {user ? (
        <div className="mt-6 flex items-center gap-3 rounded-md bg-inverse-raised p-3">
          <Avatar initials={user.initials[locale]} />
          <div className="min-w-0">
            <p className="text-small-strong">{t(`roles.${user.role}.name`)}</p>
            {org ? <p className="truncate text-caption text-accent-on-inverse">{org.name[locale]}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
