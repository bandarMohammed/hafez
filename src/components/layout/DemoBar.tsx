"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { AccountSwitcher } from "./AccountSwitcher";
import { LanguageSwitch, LanguageToggleCompact } from "./LanguageSwitch";

/**
 * Figma "Demo Bar" — permanent on every screen (blueprint §10–11): demo badge, "nothing is actually sent"
 * notice, role switcher and language switch. Desktop and mobile variants share one component.
 */
export function DemoBar() {
  const t = useTranslations("common");
  return (
    <div className="relative z-40 flex min-h-13 items-center justify-between gap-3 bg-warning-bg px-4 py-2 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-warning px-3 py-1 text-caption whitespace-nowrap text-on-action">
          <Icon name="info" size={16} />
          <span className="lg:hidden">{t("demoBadgeShort")}</span>
          <span className="hidden lg:inline">{t("demoBadge")}</span>
        </span>
        <p className="hidden truncate text-small text-warning lg:block">{t("demoNotice")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <span className="hidden text-small-strong text-warning xl:inline">{t("switchUserLabel")}</span>
        <div className="hidden lg:block">
          <AccountSwitcher />
        </div>
        <div className="lg:hidden">
          <AccountSwitcher compact />
        </div>
        <div className="hidden lg:block">
          <LanguageSwitch />
        </div>
        <span className="lg:hidden">
          <LanguageToggleCompact />
        </span>
      </div>
    </div>
  );
}
