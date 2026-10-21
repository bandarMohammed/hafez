import { Icon } from "./Icon";
import type { IconKey } from "./Icon";

/**
 * Figma "Metric Card". Values MUST be derived from records (blueprint §5) and always carry the
 * "computed from demo data" source line so sample numbers are never presented as real impact.
 */
export function MetricCard({
  icon,
  value,
  label,
  source,
}: {
  icon: IconKey;
  value: string;
  label: string;
  source: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 shadow-card md:flex-col md:items-start md:gap-3 md:p-6">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-selected text-heading [--icon-bg:var(--color-selected)]">
        <Icon name={icon} size={24} />
      </span>
      <div className="flex min-w-0 flex-col gap-1 md:gap-3">
        <p className="flex flex-col gap-1 md:gap-3">
          <span className="text-metric text-heading">{value}</span>
          <span className="text-small text-muted">{label}</span>
        </p>
        <p className="text-caption text-muted">{source}</p>
      </div>
    </div>
  );
}
