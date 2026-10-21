import { setRequestLocale } from "next-intl/server";
import { CharityHandoversScreen } from "@/features/charity/CharityHandovers";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CharityHandoversScreen />;
}
