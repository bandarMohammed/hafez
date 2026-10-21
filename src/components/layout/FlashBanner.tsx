"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import type { Flash } from "@/data/store";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

/**
 * One-time success confirmation after an action (blueprint §5: "show a clear success or error message").
 * Rendered by every workspace shell; a confirmation is discarded as soon as the user leaves its page.
 * A flash with `on` waits for that page (the action's destination); without `on` it shows where it happened.
 */
export function FlashBanner() {
  const pathname = usePathname();
  const flash = useDemoStore((s) => s.flash);
  const clearFlash = useDemoStore((s) => s.clearFlash);
  const ref = useRef<HTMLDivElement>(null);
  const notice = flash && (!flash.on || flash.on === pathname) ? flash : null;

  // Leaving the page where the confirmation belongs discards it (it is never shown twice).
  useEffect(() => {
    const current = useDemoStore.getState().flash;
    if (current?.on && current.on !== pathname) clearFlash();
  }, [pathname, clearFlash]);

  useEffect(() => {
    if (notice) ref.current?.focus();
  }, [notice]);

  if (!notice) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      data-flash
      className="mb-6 flex items-start gap-3 rounded-lg border border-line bg-success-bg p-4 text-success"
    >
      <Icon name="check" size={24} className="shrink-0" />
      <FlashText flash={notice} />
      <DismissButton onClick={clearFlash} />
    </div>
  );
}

function FlashText({ flash }: { flash: Flash }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  let title: string;
  let body: string | null = null;
  if (flash.kind === "eventCreated") {
    title = t("newEvent.saved.title", { event: flash.eventId, status: t(`status.${flash.status}`) });
    body = t("newEvent.saved.registered");
  } else if (flash.kind === "eventPublished") {
    title = t("newEvent.saved.publishedTitle", { event: flash.eventId });
    body = t("forecast.published", { planned: n(flash.plannedKg), surplus: n(flash.expectedSurplusKg) });
  } else {
    const values = Object.fromEntries(
      Object.entries(flash.values ?? {}).map(([k, v]) => [k, typeof v === "number" ? n(v) : v]),
    );
    title = t(`flash.${flash.key}.title`, values);
    body = t.has(`flash.${flash.key}.body`) ? t(`flash.${flash.key}.body`, values) : null;
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-body-strong">{title}</p>
      {body ? <p className="text-small">{body}</p> : null}
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("dismiss")}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface/60"
    >
      <Icon name="close" size={20} />
    </button>
  );
}
