import { setRequestLocale } from "next-intl/server";
import { OpportunitiesScreen } from "@/features/charity/Opportunities";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <OpportunitiesScreen />;
}
