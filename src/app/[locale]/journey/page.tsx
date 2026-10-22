import { setRequestLocale } from "next-intl/server";
import { JourneyScreen } from "@/features/journey/JourneyScreen";

/** "Hafez journey" — one page that plays the whole flow for the pitch; every role screen stays available. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <JourneyScreen />;
}
