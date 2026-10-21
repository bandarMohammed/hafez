"use client";

import { useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { ScreenComingSoon } from "@/features/common/ComingSoon";

/**
 * Event detail / edit — designed, not built yet. Events live in browser storage (new ones are created by C2),
 * so the id is checked here on the client: unknown or not-visible events show the not-found state.
 * (The HTTP status is 200 for these client-checked paths; the server can't see local demo data.)
 */
export function EventScreenPlaceholder({ eventId, mode }: { eventId: string; mode: "view" | "edit" }) {
  const t = useTranslations();
  const user = useCurrentUser();
  const event = useDemoStore((s) => s.data?.events.find((e) => e.id === eventId));

  if (!user || !event || !can(user, "event.view", { kind: "event", event })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("states.notFound.title")}
        body={t("states.notFound.body")}
        actions={<ButtonLink href="/hall">{t("states.comingSoon.backToHome")}</ButtonLink>}
      />
    );
  }

  const title = t(mode === "edit" ? "screens.editEvent" : "screens.viewEvent", { event: event.id });
  return <ScreenComingSoon screenTitle={title} homeHref="/hall" />;
}
