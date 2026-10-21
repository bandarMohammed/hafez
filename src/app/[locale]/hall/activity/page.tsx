import { setRequestLocale } from "next-intl/server";
import { HallActivityScreen } from "@/features/hall/HallScreens";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <HallActivityScreen />;
}
