import { setRequestLocale } from "next-intl/server";
import { ReportsScreen } from "@/features/charity/Reports";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ReportsScreen />;
}
