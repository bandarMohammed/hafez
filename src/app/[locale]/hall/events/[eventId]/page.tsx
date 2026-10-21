import { setRequestLocale } from "next-intl/server";
import { HallEventDetail } from "@/features/hall/HallEventDetail";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  return <HallEventDetail eventId={decodeURIComponent(eventId)} />;
}
