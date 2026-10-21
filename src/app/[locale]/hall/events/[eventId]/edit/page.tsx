import { setRequestLocale } from "next-intl/server";
import { HallEventEdit } from "@/features/hall/HallEventEdit";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  return <HallEventEdit eventId={decodeURIComponent(eventId)} />;
}
