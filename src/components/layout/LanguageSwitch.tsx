"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * Figma "Language Switch" (segmented العربية | English). Switching keeps the same screen and flips
 * the whole layout direction (RTL ⇄ LTR), not only the text.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className={cn("inline-flex gap-1 rounded-full border border-line bg-surface p-1", className)}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <Link
            key={l}
            href={pathname}
            locale={l}
            lang={l}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full px-3 text-small-strong transition-colors",
              active ? "bg-inverse text-on-inverse" : "text-muted hover:text-heading",
            )}
          >
            {t(l)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Compact variant used in the mobile demo bar (Figma: "EN" / "عربي" chip). */
export function LanguageToggleCompact() {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const other: Locale = locale === "ar" ? "en" : "ar";
  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      aria-label={t("compactSwitchLabel")}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-line bg-surface px-3 text-small-strong text-heading hover:bg-selected"
    >
      {t("compactSwitch")}
    </Link>
  );
}
