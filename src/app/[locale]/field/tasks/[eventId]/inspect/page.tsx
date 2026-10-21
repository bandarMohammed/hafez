import { setRequestLocale } from "next-intl/server";
import { InspectionScreen } from "@/features/field/InspectionForm";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <InspectionScreen eventId={decodeURIComponent(p.eventId)} />;
}
