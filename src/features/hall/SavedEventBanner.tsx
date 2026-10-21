"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useDemoStore } from "@/data/store";
import { Icon } from "@/components/ui/Icon";

/**
 * One-time confirmation after C2 "Save as registered" or a C3 decision (not in Figma — feedback is required so the save is visible).
 * The store's flash is copied into local state on mount and then cleared, so it shows exactly once
 * (also under React StrictMode's double effects) and never reappears when returning to C1 later.
 */
export function SavedEventBanner() {
  const t = useTranslations("newEvent.saved");
  const tStatus = useTranslations("status");
  const tForecast = useTranslations("forecast");
  const locale = useLocale() as Locale;
  const clearFlash = useDemoStore((s) => s.clearFlash);
  const [notice, setNotice] = useState(() => useDemoStore.getState().flash);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (useDemoStore.getState().flash) clearFlash();
  }, [clearFlash]);
  useEffect(() => {
    if (notice) ref.current?.focus();
  }, [notice]);

  if (!notice) return null;

  const [title, body] =
    notice.kind === "eventPublished"
      ? [
          t("publishedTitle", { event: notice.eventId }),
          tForecast("published", {
            planned: formatNumber(notice.plannedKg, locale),
            surplus: formatNumber(notice.expectedSurplusKg, locale),
          }),
        ]
      : [t("title", { event: notice.eventId, status: tStatus(notice.status) }), t("registered")];

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex items-start gap-3 rounded-lg border border-line bg-success-bg p-4 text-success"
    >
      <Icon name="check" size={24} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body-strong">{title}</p>
        <p className="text-small">{body}</p>
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label={t("dismiss")}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface/60"
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
