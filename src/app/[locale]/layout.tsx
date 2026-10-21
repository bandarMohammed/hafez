import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DIRECTION, routing } from "@/i18n/routing";
import { inter, tajawal } from "../fonts";
import { StoreInit } from "@/components/layout/StoreInit";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export const viewport: Viewport = { themeColor: "#0E3524", width: "device-width", initialScale: 1 };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} dir={DIRECTION[locale]} className={`${tajawal.variable} ${inter.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-small-strong focus:text-heading"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <StoreInit />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
