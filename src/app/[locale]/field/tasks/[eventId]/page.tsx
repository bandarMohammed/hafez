import { setRequestLocale } from "next-intl/server";
import { TaskDetail } from "@/features/field/TaskDetail";

export default async function Page({ params }: { params: Promise<{ locale: string; eventId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <TaskDetail eventId={decodeURIComponent(p.eventId)} />;
}
