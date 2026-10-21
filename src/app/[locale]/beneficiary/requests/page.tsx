import { setRequestLocale } from "next-intl/server";
import { MyRequestsScreen } from "@/features/beneficiary/Requests";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <MyRequestsScreen />;
}
