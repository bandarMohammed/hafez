import { setRequestLocale } from "next-intl/server";
import { FoodHome } from "@/features/beneficiary/FoodScreens";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <FoodHome />;
}
