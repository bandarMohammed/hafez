import { setRequestLocale } from "next-intl/server";
import { HallHome } from "@/features/hall/HallHome";

export default async function HallHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HallHome />;
}
