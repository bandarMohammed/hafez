"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import type { Locale } from "@/i18n/routing";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";

/**
 * Figma E7 "Profile & settings": who you are, what this role can / can't do (blueprint §2), language,
 * switch demo account. No password exists in demo mode. Reused for the hall profile with extra details.
 */
export function ProfileScreen({
  role,
  extra,
}: {
  role: "hall" | "field" | "charity" | "beneficiary";
  extra?: ReactNode;
}) {
  const t = useTranslations("profile");
  const tr = useTranslations("roles");
  const locale = useLocale() as Locale;
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  if (!user || !data) return null;
  const org = user.organizationId ? data.organizations.find((o) => o.id === user.organizationId) : undefined;
  const canList = t.raw(`${role}.can`) as string[];
  const cannotList = t.raw(`${role}.cannot`) as string[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t(`${role}.title`)} subtitle={t("subtitle")} className="mb-2" />

      <section className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5">
        <Avatar initials={user.initials[locale]} size={48} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body-strong text-heading">
            {user.displayName?.[locale] ??
              (user.pseudonym ? t("pseudonym", { code: user.pseudonym }) : tr(`${user.role}.name`))}
          </p>
          <p className="text-caption text-muted">
            {tr(`${user.role}.name`)} · <bdi>{user.id}</bdi>
          </p>
          {org ? <p className="text-caption text-action">{org.name[locale]}</p> : null}
        </div>
      </section>

      {extra}

      <section aria-labelledby="perm-title" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="perm-title" className="mb-3 text-body-strong text-heading">
          {t("permissions")}
        </h2>
        <ul className="flex flex-col gap-2">
          {canList.map((s) => (
            <li key={s} className="flex items-start gap-2 text-small text-ink">
              <Icon name="check" size={18} className="mt-0.5 text-success" />
              <span>
                <span className="sr-only">{t("allowed")}: </span>
                {s}
              </span>
            </li>
          ))}
          {cannotList.map((s) => (
            <li key={s} className="flex items-start gap-2 text-small text-muted">
              <Icon name="close" size={18} className="mt-0.5 text-danger" />
              <span>
                <span className="sr-only">{t("notAllowed")}: </span>
                {s}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="settings-title"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="settings-title" className="text-body-strong text-heading">
          {t("settings")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-small text-ink">{t("language")}</span>
          <LanguageSwitch />
        </div>
        <p className="text-caption text-muted">{t("noPassword")}</p>
      </section>

      <ButtonLink href="/" variant="secondary" fullWidth>
        {t("switchAccount")}
      </ButtonLink>
    </div>
  );
}
