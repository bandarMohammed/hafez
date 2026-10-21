import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SEED } from "@/data/seed";
import { ScreenComingSoon } from "@/features/common/ComingSoon";

/**
 * Hall screens designed in Figma but not built yet (C2, event detail, handovers, activity, profile).
 *
 * The valid paths are a fixed, known set, so they are declared up front and `dynamicParams = false`
 * makes every other path a routing-level 404. (A `notFound()` thrown during rendering can only
 * produce a 200 + noindex once streaming has started — see Next.js docs "Streaming › Status codes".)
 * Event ids come from the demo seed; event creation is not implemented, so no other ids can exist yet.
 */
export const dynamicParams = false;

const SCREENS: Record<string, { key: string; event?: string }> = {
  events: { key: "hall.nav.myEvents" },
  handovers: { key: "hall.nav.handovers" },
  activity: { key: "hall.nav.activity" },
  profile: { key: "hall.nav.profile" },
  "events/new": { key: "screens.newEvent" },
  ...Object.fromEntries(
    SEED.events.flatMap((e) => [
      [`events/${e.id}`, { key: "screens.viewEvent", event: e.id }],
      [`events/${e.id}/edit`, { key: "screens.editEvent", event: e.id }],
    ]),
  ),
};

export function generateStaticParams() {
  return Object.keys(SCREENS).map((path) => ({ slug: path.split("/") }));
}

export default async function HallComingSoonPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;
  const screen = SCREENS[slug.join("/")];
  if (!screen) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const title = screen.event ? t(screen.key, { event: screen.event }) : t(screen.key);
  return <ScreenComingSoon screenTitle={title} homeHref="/hall" />;
}
