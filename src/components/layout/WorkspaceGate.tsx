"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { homePathFor } from "@/domain/roles";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";

/**
 * Guards a role workspace and renders every non-happy state explicitly:
 * loading (data lives in the browser) → corrupted data → no account chosen → no permission (Figma F2).
 * UI guard only — see src/domain/permissions.ts for the security disclaimer.
 */
export function WorkspaceGate({ workspace, children }: { workspace: string; children: ReactNode }) {
  const t = useTranslations("states");
  const tRoles = useTranslations("roles");
  const status = useDemoStore((s) => s.status);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);
  const user = useCurrentUser();

  if (status === "idle") {
    return (
      <div role="status" aria-live="polite" className="mx-auto max-w-[1200px] px-4 py-8 lg:px-8">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-8 h-10 w-80 max-w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <main id="main">
        <StateMessage
          asPage
          icon="alert"
          tone="danger"
          title={t("error.title")}
          body={t("error.body")}
          actions={<Button onClick={resetDemoData}>{t("error.reset")}</Button>}
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main id="main">
        <StateMessage
          asPage
          icon="info"
          title={t("noAccount.title")}
          body={t("noAccount.body")}
          actions={<ButtonLink href="/">{t("noAccount.action")}</ButtonLink>}
        />
      </main>
    );
  }

  if (!can(user, "workspace.enter", { kind: "workspace", workspace })) {
    return (
      <main id="main">
        <StateMessage
          asPage
          icon="lock"
          tone="info"
          title={t("accessDenied.title")}
          body={t("accessDenied.body", { role: tRoles(`${user.role}.name`) })}
          actions={
            <>
              <ButtonLink href={homePathFor(user.role)}>{t("accessDenied.goHome")}</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                {t("accessDenied.switch")}
              </ButtonLink>
            </>
          }
        />
      </main>
    );
  }

  return <>{children}</>;
}
