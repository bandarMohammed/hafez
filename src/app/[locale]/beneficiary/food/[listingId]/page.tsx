import { setRequestLocale } from "next-intl/server";
import { FoodDetail } from "@/features/beneficiary/FoodScreens";

export default async function Page({ params }: { params: Promise<{ locale: string; listingId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <FoodDetail listingId={decodeURIComponent(p.listingId)} />;
}
