import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenComingSoon } from "@/features/common/ComingSoon";

/**
 * Hall screens designed in Figma but not built yet (handovers, activity, profile).
 * `/hall/events…` has its own routes (list, C2 new event, event view/edit by id).
 *
 * The valid paths are a fixed, known set, so they are declared up front and `dynamicParams = false`
 * makes every other path a routing-level 404. (A `notFound()` thrown during rendering can only
 * produce a 200 + noindex once streaming has started — see Next.js docs "Streaming › Status codes".)
 */
export const dynamicParams = false;

const SCREENS: Record<string, string> = {
  handovers: "hall.nav.handovers",
  activity: "hall.nav.activity",
  profile: "hall.nav.profile",
};

export function generateStaticParams() {
  return Object.keys(SCREENS).map((path) => ({ slug: path.split("/") }));
}

export default async function HallComingSoonPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;
  const key = SCREENS[slug.join("/")];
  if (!key) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return <ScreenComingSoon screenTitle={t(key)} homeHref="/hall" />;
}
