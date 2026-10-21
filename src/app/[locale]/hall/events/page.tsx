import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenComingSoon } from "@/features/common/ComingSoon";

/** "My hall's events" full list — designed, not built yet (C1 already lists the hall's events). */
export default async function HallEventsListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return <ScreenComingSoon screenTitle={t("hall.nav.myEvents")} homeHref="/hall" />;
}
