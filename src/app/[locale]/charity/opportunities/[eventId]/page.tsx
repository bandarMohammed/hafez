import { setRequestLocale } from "next-intl/server";
import { OpportunityDetail } from "@/features/charity/Opportunities";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <OpportunityDetail eventId={decodeURIComponent(p.eventId)} />;
}
