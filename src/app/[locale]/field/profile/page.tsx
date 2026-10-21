import { setRequestLocale } from "next-intl/server";
import { ProfileScreen } from "@/features/common/ProfileScreen";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ProfileScreen role="field" />;
}
