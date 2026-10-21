import { setRequestLocale } from "next-intl/server";
import { CharityEventView } from "@/features/charity/CharityEventView";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <CharityEventView eventId={decodeURIComponent(p.eventId)} />;
}
