import { setRequestLocale } from "next-intl/server";
import { ConfirmPickupScreen } from "@/features/beneficiary/Requests";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; requestId: string }>;
  searchParams: Promise<{ issue?: string }>;
}) {
  const p = await params;
  setRequestLocale(p.locale);
  const { issue } = await searchParams;
  return <ConfirmPickupScreen requestId={decodeURIComponent(p.requestId)} issue={issue === "1"} />;
}
