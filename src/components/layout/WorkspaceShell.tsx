"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { getRoleConfig } from "@/domain/roles";
import type { NavItem } from "@/domain/roles";
import type { Role } from "@/domain/types";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { FlashBanner } from "./FlashBanner";
import { Sidebar, isNavActive } from "./Sidebar";

/**
 * Role workspace layout.
 * ≥1024px (lg): Figma desktop layout — fixed 280px Forest sidebar + content, for every role.
 * <1024px:
 *  - mobile-first roles (Figma D/E/H mobile frames): app bar (logo + notices bell) and a bottom tab bar;
 *    items that don't fit in the tabs stay reachable through the menu drawer;
 *  - hall (desktop-only Figma): app bar + the same sidebar inside a modal drawer (native <dialog>).
 */
export function WorkspaceShell({ role, children }: { role: Role; children: ReactNode }) {
  const config = getRoleConfig(role);
  const labelNamespace = `${config.workspace}.nav`;
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const tabs = config.mobileTabs ? config.nav.filter((n) => config.mobileTabs!.includes(n.key)) : [];
  const needsDrawer = tabs.length === 0 || config.nav.some((n) => !tabs.includes(n) && n.href !== config.noticesHref);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:flex-row">
      {/* The Forest column spans the full page height; its content stays pinned while scrolling. */}
      <aside className="hidden w-70 shrink-0 bg-inverse lg:block">
        <div className="sticky top-0 h-[calc(100dvh-4rem)]">
          <Sidebar items={config.nav} labelNamespace={labelNamespace} />
        </div>
      </aside>

      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo locale={locale} width={100} />
        <div className="flex items-center gap-2">
          {config.noticesHref ? <NoticesBell href={config.noticesHref} /> : null}
          {needsDrawer ? (
            <button
              type="button"
              onClick={() => drawer.current?.showModal()}
              aria-label={t("openMenu")}
              className="inline-flex size-11 items-center justify-center rounded-md border border-line bg-surface text-heading hover:bg-selected"
            >
              <Icon name="menu" />
            </button>
          ) : null}
        </div>
      </div>

      {needsDrawer ? (
        <dialog
          ref={drawer}
          aria-label={t("mainNav")}
          className="m-0 me-auto h-dvh max-h-dvh w-[min(300px,85vw)] max-w-none bg-transparent p-0 backdrop:bg-inverse/50 open:block"
          onClick={(e) => {
            if (e.target === drawer.current) drawer.current.close();
          }}
        >
          <div className="relative h-full">
            <button
              type="button"
              onClick={() => drawer.current?.close()}
              aria-label={t("closeMenu")}
              className="absolute end-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-md text-on-inverse hover:bg-inverse-raised"
            >
              <Icon name="close" />
            </button>
            <Sidebar items={config.nav} labelNamespace={labelNamespace} onNavigate={() => drawer.current?.close()} />
          </div>
        </dialog>
      ) : null}

      <main
        id="main"
        className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", tabs.length > 0 && "pb-28 lg:pb-8")}
      >
        <div className="mx-auto max-w-[1200px]">
          <FlashBanner />
          {children}
        </div>
      </main>

      {tabs.length ? <BottomTabs items={tabs} labelNamespace={labelNamespace} pathname={pathname} /> : null}
    </div>
  );
}

/** Figma "Bottom Nav Item": icon in a mint pill when active, label below. */
function BottomTabs({
  items,
  labelNamespace,
  pathname,
}: {
  items: NavItem[];
  labelNamespace: string;
  pathname: string;
}) {
  const t = useTranslations();
  return (
    <nav
      aria-label={t("common.mainNav")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2">
        {items.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center"
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-14 items-center justify-center rounded-full",
                    active ? "bg-selected text-heading" : "text-muted",
                  )}
                >
                  <Icon name={item.icon} size={22} />
                </span>
                <span className={cn("text-caption", active ? "font-bold text-heading" : "text-muted")}>
                  {t(`${labelNamespace}.${item.key}`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NoticesBell({ href }: { href: string }) {
  const t = useTranslations("notices");
  const locale = useLocale() as Locale;
  const user = useCurrentUser();
  const unread = useDemoStore((s) =>
    user ? (s.data?.notices.filter((n) => n.recipientUserId === user.id && !n.readAt).length ?? 0) : 0,
  );
  return (
    <Link
      href={href}
      aria-label={t("bellLabel", { count: unread })}
      className="relative inline-flex size-11 items-center justify-center rounded-md border border-line bg-surface text-heading hover:bg-selected"
    >
      <Icon name="bell" />
      {unread ? (
        <span
          aria-hidden="true"
          className="absolute -end-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-caption text-on-action"
        >
          {formatNumber(unread, locale)}
        </span>
      ) : null}
    </Link>
  );
}
