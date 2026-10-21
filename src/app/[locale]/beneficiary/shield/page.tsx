import { setRequestLocale } from "next-intl/server";
import { ShieldScreen } from "@/features/beneficiary/Shield";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ShieldScreen />;
}
