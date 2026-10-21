import { setRequestLocale } from "next-intl/server";
import { AssignScreen } from "@/features/charity/AssignScreen";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <AssignScreen eventId={decodeURIComponent(p.eventId)} />;
}
