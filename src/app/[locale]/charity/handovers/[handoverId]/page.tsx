import { setRequestLocale } from "next-intl/server";
import { CharityHandoverDetail } from "@/features/charity/CharityHandovers";

export default async function Page({ params }: { params: Promise<{ locale: string; handoverId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <CharityHandoverDetail handoverId={decodeURIComponent(p.handoverId)} />;
}
