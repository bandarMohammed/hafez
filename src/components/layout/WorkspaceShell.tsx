"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { NavItem } from "@/domain/roles";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Sidebar } from "./Sidebar";

/**
 * Role workspace layout.
 * ≥1024px (lg): Figma desktop layout — fixed 280px Forest sidebar + content.
 * <1024px: not specified in Figma → documented adaptation: top app bar + the same sidebar inside a modal drawer
 * (native <dialog>: focus trap + Esc for free).
 */
export function WorkspaceShell({
  nav,
  labelNamespace,
  children,
}: {
  nav: NavItem[];
  labelNamespace: string;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const drawer = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex min-h-[calc(100dvh-52px)] flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-[calc(100dvh-52px)] w-70 shrink-0 lg:block">
        <Sidebar items={nav} labelNamespace={labelNamespace} />
      </aside>

      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo locale={locale} width={100} />
        <button
          type="button"
          onClick={() => drawer.current?.showModal()}
          aria-label={t("openMenu")}
          className="inline-flex size-11 items-center justify-center rounded-md border border-line bg-surface text-heading hover:bg-selected"
        >
          <Icon name="menu" />
        </button>
      </div>

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
          <Sidebar items={nav} labelNamespace={labelNamespace} onNavigate={() => drawer.current?.close()} />
        </div>
      </dialog>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
