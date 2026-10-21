import { setRequestLocale } from "next-intl/server";
import { PublishListingScreen } from "@/features/charity/Listings";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PublishListingScreen />;
}
