import { setRequestLocale } from "next-intl/server";
import { DeclineScreen } from "@/features/charity/Opportunities";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <DeclineScreen eventId={decodeURIComponent(p.eventId)} />;
}
