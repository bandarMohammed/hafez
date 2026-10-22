"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { clearCameFromJourney, useCameFromJourney } from "./returnToJourney";

/**
 * "Back to the Hafez journey" strip under the demo bar of the role screens — shown only when the screen was
 * opened from the journey page. It sits in the page flow (never over a button) and only navigates:
 * it doesn't change any record.
 */
export function JourneyReturn() {
  const t = useTranslations("journey");
  const show = useCameFromJourney();
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-inverse px-4 py-2 text-on-inverse lg:px-8">
      <p className="text-caption text-accent-on-inverse">{t("openedFromJourney")}</p>
      <Link
        href="/journey"
        onClick={clearCameFromJourney}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-4 text-small-strong text-heading hover:bg-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-inverse"
      >
        <Icon name="chevronBack" size={18} />
        {t("backToJourney")}
      </Link>
    </div>
  );
}
