import { setRequestLocale } from "next-intl/server";
import { MyReportsScreen } from "@/features/beneficiary/Reports";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <MyReportsScreen />;
}
