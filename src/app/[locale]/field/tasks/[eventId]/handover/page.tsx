import { setRequestLocale } from "next-intl/server";
import { HandoverScreen } from "@/features/field/HandoverForm";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <HandoverScreen eventId={decodeURIComponent(p.eventId)} />;
}
