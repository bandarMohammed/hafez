import { setRequestLocale } from "next-intl/server";
import { HallHandoversScreen } from "@/features/hall/HallScreens";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <HallHandoversScreen />;
}
