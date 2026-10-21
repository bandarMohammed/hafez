import { setRequestLocale } from "next-intl/server";
import { AccountPicker } from "@/features/account-picker/AccountPicker";

/** Entry: Figma A2 (choose a demo account). The landing page A1 is not part of this iteration. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountPicker />;
}
