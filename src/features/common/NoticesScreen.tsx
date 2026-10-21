"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import type { DemoDataset, Notice } from "@/domain/types";
import { markAllNoticesRead, markNoticeRead } from "@/domain/workflow/notices";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/Choice";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { useFormatters } from "./useFormatters";

const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** Figma E6 "Notices" — in-app notices only (no SMS / WhatsApp). Reused by every role's bell. */
export function NoticesScreen() {
  const t = useTranslations("notices");
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  const dispatch = useDemoStore((s) => s.dispatch);
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  if (!user || !data) return null;

  const mine = data.notices
    .filter((n) => n.recipientUserId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const unread = mine.filter((n) => !n.readAt);
  const shown = filter === "unread" ? unread : mine;

  const open = (n: Notice) => {
    dispatch((c) => markNoticeRead(c, n.id));
    if (n.link) router.push(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label={t("filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("all", { count: mine.length }) },
            { value: "unread", label: t("unread", { count: unread.length }) },
          ]}
        />
        {unread.length ? (
          <Button variant="ghost" onClick={() => dispatch((c) => markAllNoticesRead(c))}>
            {t("markAll")}
          </Button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <StateMessage icon="bell" title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((n) => (
            <li key={n.id}>
              <NoticeItem data={data} notice={n} onOpen={() => open(n)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Figma "Notification Item" (Unread / Read). */
function NoticeItem({ data, notice, onOpen }: { data: DemoDataset; notice: Notice; onOpen: () => void }) {
  const t = useTranslations();
  const f = useFormatters(data);
  const params = Object.fromEntries(
    Object.entries(notice.params).map(([k, v]) => {
      if (typeof v === "number") return [k, f.n(v)];
      if (k === "charity") return [k, f.orgName(v)];
      if (k === "rep") return [k, f.userName(v)];
      if (k === "status") return [k, t.has(`status.${v}`) ? t(`status.${v}`) : t(`requestStatus.${v}`)];
      if (k === "outcome") return [k, t(`notices.outcome.${v}`)];
      if (ISO.test(v)) return [k, f.shortDateTime(v)];
      return [k, v];
    }),
  );
  const isUnread = !notice.readAt;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors hover:border-line-strong",
        isUnread ? "border-action/40 bg-selected" : "border-line bg-surface",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("mt-2 size-2.5 shrink-0 rounded-full", isUnread ? "bg-action" : "bg-line-strong")}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("text-small text-heading", isUnread && "font-bold")}>
          {t(`notices.kinds.${notice.kind}.title`, params)}
          {isUnread ? <span className="sr-only"> ({t("notices.unreadTag")})</span> : null}
        </span>
        <span className="text-small text-ink">{t(`notices.kinds.${notice.kind}.body`, params)}</span>
        <span className="tabular text-caption text-muted">{f.shortDateTime(notice.createdAt)}</span>
      </span>
    </button>
  );
}
