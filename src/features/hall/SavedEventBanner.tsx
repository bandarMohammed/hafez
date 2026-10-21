"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { Icon } from "@/components/ui/Icon";

/**
 * One-time confirmation after C2 saves (not in Figma — feedback is required so the save is visible).
 * The store's flash is copied into local state on mount and then cleared, so it shows exactly once
 * (also under React StrictMode's double effects) and never reappears when returning to C1 later.
 */
export function SavedEventBanner() {
  const t = useTranslations("newEvent.saved");
  const tStatus = useTranslations("status");
  const clearFlash = useDemoStore((s) => s.clearFlash);
  const [notice, setNotice] = useState(() => useDemoStore.getState().flash);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (useDemoStore.getState().flash) clearFlash();
  }, [clearFlash]);
  useEffect(() => {
    if (notice) ref.current?.focus();
  }, [notice]);

  if (!notice || notice.kind !== "eventCreated") return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex items-start gap-3 rounded-lg border border-line bg-success-bg p-4 text-success"
    >
      <Icon name="check" size={24} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body-strong">{t("title", { event: notice.eventId, status: tStatus(notice.status) })}</p>
        <p className="text-small">{t(notice.status === "available" ? "available" : "registered")}</p>
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
