import { setRequestLocale } from "next-intl/server";
import { ReportInspectionScreen } from "@/features/field/ReportInspection";

export default async function Page({ params }: { params: Promise<{ locale: string; reportId: string }> }) {
  const p = await params;
  setRequestLocale(p.locale);
  return <ReportInspectionScreen reportId={decodeURIComponent(p.reportId)} />;
}
