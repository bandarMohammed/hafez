"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { ROLE_CONFIG, homePathFor } from "@/domain/roles";
import type { DemoUser } from "@/domain/types";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { DemoBar } from "@/components/layout/DemoBar";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";
import { AccountCard } from "./AccountCard";

/** Figma A2 — "Choose a demo account" (frames 15:564 AR / 15:650 EN). Default selection: hall manager. */
const DEFAULT_ACCOUNT = "demo-hall-01";

export function AccountPicker() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const status = useDemoStore((s) => s.status);
  const data = useDemoStore((s) => s.data);
  const selectUser = useDemoStore((s) => s.selectUser);
  const resetDemoData = useDemoStore((s) => s.resetDemoData);
  const current = useCurrentUser();

  const accounts = ROLE_CONFIG.map((cfg) => ({ cfg, user: data?.users.find((u) => u.id === cfg.accountId) })).filter(
    (a): a is { cfg: (typeof ROLE_CONFIG)[number]; user: DemoUser } => Boolean(a.user),
  );
  const selected = accounts.find((a) => a.user.id === (current?.id ?? DEFAULT_ACCOUNT)) ?? accounts[0];

  const choose = (user: DemoUser) => {
    selectUser(user.id);
    router.push(homePathFor(user.role));
  };

  const orgName = (u: DemoUser) =>
    u.organizationId
      ? (data?.organizations.find((o) => o.id === u.organizationId)?.name[locale] ?? "")
      : t("orgLabel.beneficiary");

  return (
    <>
      <DemoBar />
      <main id="main" className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex items-center justify-between gap-4">
          <span className="lg:hidden">
            <Logo locale={locale} width={110} priority />
          </span>
          <span className="hidden lg:inline">
            <Logo locale={locale} width={150} priority />
          </span>
          <LanguageSwitch />
        </header>

        <div className="mt-4 flex flex-col gap-1 lg:mt-8">
          <h1 className="text-h3 text-heading">{t("picker.title")}</h1>
          <p className="max-w-2xl text-small text-muted">{t("picker.subtitle")}</p>
        </div>

        {/* Pitch entry: the whole journey on one page (added for the hackathon; the accounts below are unchanged). */}
        <section
          aria-labelledby="journey-entry"
          className="mt-4 flex flex-col gap-3 rounded-lg bg-inverse p-5 text-on-inverse sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <h2 id="journey-entry" className="text-body-strong text-on-inverse">
              {t("picker.journeyTitle")}
            </h2>
            <p className="text-small text-accent-on-inverse">{t("picker.journeyBody")}</p>
          </div>
          <ButtonLink href="/journey" className="shrink-0">
            {t("picker.journeyCta")}
          </ButtonLink>
        </section>

        {status === "error" ? (
          <StateMessage
            icon="alert"
            tone="danger"
            title={t("states.error.title")}
            body={t("states.error.body")}
            actions={<Button onClick={resetDemoData}>{t("states.error.reset")}</Button>}
          />
        ) : status === "idle" || !selected ? (
          <div role="status" aria-live="polite" className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">{t("states.loading")}</span>
            {ROLE_CONFIG.map((c) => (
              <Skeleton key={c.role} className="h-[105px] rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map(({ cfg, user }) => (
                <li key={user.id}>
                  <AccountCard
                    user={user}
                    roleName={t(`roles.${user.role}.name`)}
                    orgLine={`${orgName(user)} · ${user.id}`}
                    summary={t(`roles.${user.role}.summary`)}
                    underDevelopment={cfg.implemented ? undefined : t("picker.underDevelopment")}
                    selected={user.id === selected.user.id}
                    initials={user.initials[locale]}
                    onChoose={() => choose(user)}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:items-center">
              <Notice className="lg:flex-1">{t("picker.notice")}</Notice>
              <Button className="w-full lg:w-auto" onClick={() => choose(selected.user)}>
                {t("picker.continueAs", { role: t(`roles.${selected.user.role}.name`) })}
              </Button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
