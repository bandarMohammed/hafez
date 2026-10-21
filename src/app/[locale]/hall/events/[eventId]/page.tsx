import { setRequestLocale } from "next-intl/server";
import { EventScreenPlaceholder } from "@/features/hall/EventScreenPlaceholder";

export default async function EventDetailPage({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  return <EventScreenPlaceholder eventId={decodeURIComponent(eventId)} mode="view" />;
}
