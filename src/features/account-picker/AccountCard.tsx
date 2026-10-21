import type { DemoUser } from "@/domain/types";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

interface AccountCardProps {
  user: DemoUser;
  initials: string;
  roleName: string;
  orgLine: string;
  summary: string;
  underDevelopment?: string;
  selected: boolean;
  onChoose: () => void;
}

/** Figma frame "Account/<id>": avatar · role · org · id · what the role can do · chevron. Selected = mint + 2px action border. */
export function AccountCard({
  user,
  initials,
  roleName,
  orgLine,
  summary,
  underDevelopment,
  selected,
  onChoose,
}: AccountCardProps) {
  return (
    <button
      type="button"
      onClick={onChoose}
      data-account={user.id}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-full min-h-[105px] w-full items-center gap-3 rounded-lg border p-4 text-start transition-colors",
        selected
          ? "border-action bg-selected shadow-[inset_0_0_0_1px_var(--color-action)]"
          : "border-line bg-surface hover:border-line-strong hover:bg-page",
      )}
    >
      <Avatar initials={initials} size={40} className={selected ? "bg-surface" : undefined} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-body-strong text-heading">{roleName}</span>
          {underDevelopment ? (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-caption text-warning">{underDevelopment}</span>
          ) : null}
        </span>
        <span className="text-caption text-muted">{orgLine}</span>
        <span className="text-caption text-action">{summary}</span>
      </span>
      <Icon name="chevronForward" size={18} className="text-muted" />
    </button>
  );
}
