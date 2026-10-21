import { setRequestLocale } from "next-intl/server";
import { ForecastScreen } from "@/features/hall/ForecastScreen";

/** Figma C3 — surplus forecast & recommendation (reached from C2 "Save & make available"). */
export default async function ForecastPage({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  return <ForecastScreen eventId={decodeURIComponent(eventId)} />;
}
