import { setRequestLocale } from "next-intl/server";
import { NoticesScreen } from "@/features/common/NoticesScreen";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <NoticesScreen />;
}
