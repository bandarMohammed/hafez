import { setRequestLocale } from "next-intl/server";
import { NewEventForm } from "@/features/hall/NewEventForm";

/** Figma C2 — register a new event. Rendered inside the hall WorkspaceGate (hall layout). */
export default async function NewEventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NewEventForm />;
}
