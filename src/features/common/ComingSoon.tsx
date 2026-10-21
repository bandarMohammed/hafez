"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

/**
 * Explicit "under development" state for screens/roles that are designed in Figma but not built yet.
 * Keeps every visible control functional (no dead buttons) without pretending the feature exists.
 */
export function ScreenComingSoon({ screenTitle, homeHref }: { screenTitle: string; homeHref: string }) {
  const t = useTranslations("states.comingSoon");
  return (
    <StateMessage
      asPage
      icon="info"
      badge={t("badge")}
      title={t("screenTitle", { screen: screenTitle })}
      body={t("screenBody")}
      actions={<ButtonLink href={homeHref}>{t("backToHome")}</ButtonLink>}
    />
  );
}

export function RoleComingSoon({ roleName, frame }: { roleName: string; frame: string }) {
  const t = useTranslations("states.comingSoon");
  return (
    <StateMessage
      asPage
      icon="info"
      badge={t("badge")}
      title={t("roleTitle", { role: roleName })}
      body={t("roleBody", { frame })}
      actions={
        <>
          <ButtonLink href="/">{t("backToPicker")}</ButtonLink>
          <ButtonLink href="/hall" variant="secondary">
            {t("tryHall")}
          </ButtonLink>
        </>
      }
    />
  );
}
