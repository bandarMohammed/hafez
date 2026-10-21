import { DEMO_CONFIG } from "@/config/demo";
import type { Locale } from "@/i18n/routing";

/**
 * Brand rule (brand-guidelines §08): Latin digits 0–9 in UI and tables, Gregorian calendar
 * (Open Questions decision Q10). Plain "ar" would give Arabic-Indic digits; "ar-SA" would give Hijri.
 */
const INTL_LOCALE: Record<Locale, string> = { ar: "ar-u-ca-gregory-nu-latn", en: "en-GB-u-ca-gregory-nu-latn" };

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: locale === "ar" ? "long" : "short",
    year: "numeric",
    timeZone: DEMO_CONFIG.timeZone,
  }).format(new Date(iso));
}

export function formatShortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: locale === "ar" ? "long" : "short",
    timeZone: DEMO_CONFIG.timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: DEMO_CONFIG.timeZone,
  }).format(new Date(iso));
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 }).format(value);
}
