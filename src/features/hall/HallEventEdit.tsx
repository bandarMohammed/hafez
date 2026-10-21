"use client";

import { useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { NewEventForm } from "./NewEventForm";

/** Edit an event before pickup — the C2 form prefilled (same fields and validation). */
export function HallEventEdit({ eventId }: { eventId: string }) {
  const t = useTranslations("states.notFound");
  const user = useCurrentUser();
  const event = useDemoStore((s) => s.data?.events.find((e) => e.id === eventId));
  if (!user) return null;
  if (!event || !can(user, "event.view", { kind: "event", event })) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("title")}
        body={t("body")}
        actions={<ButtonLink href="/hall/events">{t("action")}</ButtonLink>}
      />
    );
  }
  return <NewEventForm key={event.id} editEvent={event} />;
}
