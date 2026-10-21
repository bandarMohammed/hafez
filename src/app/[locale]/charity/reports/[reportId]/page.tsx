import { setRequestLocale } from "next-intl/server";
import { ReportDetail } from "@/features/charity/Reports";

export default async function Page({ params }: { params: Promise<{ locale: string; reportId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <ReportDetail reportId={decodeURIComponent(p.reportId)} />;
}
