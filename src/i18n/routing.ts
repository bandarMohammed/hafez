import { defineRouting } from "next-intl/routing";

/** Arabic is the default product language (RTL); English is fully supported (LTR). */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  // "/" always opens Arabic (the product default) instead of following the browser language;
  // English is one click away via the language switch, which keeps the current screen.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const DIRECTION: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };
