"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore, useCurrentUser } from "@/data/store";
import { ROLE_CONFIG, homePathFor } from "@/domain/roles";
import type { DemoUser } from "@/domain/types";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

/**
 * Figma "Account Switcher Menu" (UC-07): switch demo role from any screen, no password.
 * Must never be described as authentication.
 */
export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const current = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const selectUser = useDemoStore((s) => s.selectUser);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-account-option]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const choose = (user: DemoUser) => {
    selectUser(user.id);
    setOpen(false);
    router.push(homePathFor(user.role));
  };

  const roleName = current ? t(`roles.${current.role}.name`) : t("picker.title");
  const orgOf = (u: DemoUser) =>
    u.organizationId
      ? data?.organizations.find((o) => o.id === u.organizationId)?.name[locale]
      : t("orgLabel.beneficiary");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("accountMenu.button", { role: roleName })}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 hover:bg-selected"
      >
        <Avatar initials={current ? current.initials[locale] : "?"} size={28} />
        <span className="flex min-w-0 flex-col items-start">
          <span
            className={cn("text-small-strong whitespace-nowrap text-heading", compact && "block max-w-[38vw] truncate")}
          >
            {roleName}
          </span>
          {!compact && current ? <span className="text-caption text-muted">{current.id}</span> : null}
        </span>
        <Icon name="chevronDown" size={16} className="text-heading" />
      </button>

      {open && data ? (
        <div
          id={menuId}
          className="absolute end-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-32px))] rounded-lg border border-line bg-surface p-2 shadow-raised"
        >
          <p className="px-3 pt-1 pb-2 text-small-strong text-muted">{t("accountMenu.heading")}</p>
          <ul className="flex flex-col gap-1">
            {ROLE_CONFIG.map((cfg) => {
              const user = data.users.find((u) => u.id === cfg.accountId);
              if (!user) return null;
              const selected = current?.id === user.id;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    data-account-option
                    aria-current={selected ? "true" : undefined}
                    onClick={() => choose(user)}
                    className={cn(
                      "flex min-h-13 w-full items-center gap-3 rounded-md px-3 py-2 text-start hover:bg-selected",
                      selected && "bg-selected",
                    )}
                  >
                    <Avatar initials={user.initials[locale]} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-small-strong text-heading">{t(`roles.${user.role}.name`)}</span>
                      <span className="truncate text-caption text-muted">
                        {orgOf(user)} · {user.id}
                      </span>
                    </span>
                    {!cfg.implemented ? (
                      <span className="rounded-full bg-warning-bg px-2 py-0.5 text-caption text-warning">
                        {t("picker.underDevelopment")}
                      </span>
                    ) : null}
                    {selected ? <Icon name="check" size={18} className="text-heading" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">
            <Icon name="info" size={16} className="mt-px" />
            {t("accountMenu.note")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
