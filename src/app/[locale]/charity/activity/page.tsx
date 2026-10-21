import { setRequestLocale } from "next-intl/server";
import { CharityActivityScreen } from "@/features/charity/CharityScreens";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CharityActivityScreen />;
}
