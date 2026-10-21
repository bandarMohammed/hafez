import { setRequestLocale } from "next-intl/server";
import { ListingDetail } from "@/features/charity/Listings";

export default async function Page({ params }: { params: Promise<{ locale: string; listingId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <ListingDetail listingId={decodeURIComponent(p.listingId)} />;
}
