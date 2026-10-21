import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Figma "Input / Select" (Default · Error). Label above, hint below; on error the hint is replaced by the
 * message next to the field (Figma C2). Ids follow `${id}-hint` / `${id}-error` for aria-describedby.
 */
export function describedBy(id: string, { hint, error }: { hint?: ReactNode; error?: ReactNode }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Field({
  id,
  labelId,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  /** Set when the control is not a native input (e.g. a button-based picker) and needs aria-labelledby. */
  labelId?: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label id={labelId} htmlFor={labelId ? undefined : id} className="text-small-strong text-ink">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-caption text-danger">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function controlClasses(invalid?: boolean, className?: string) {
  return cn(
    "min-h-12 w-full rounded-md border bg-surface px-4 text-body text-ink transition-colors",
    "placeholder:text-muted focus:border-action focus:outline-none",
    invalid ? "border-[1.5px] border-danger" : "border-line hover:border-line-strong",
    className,
  );
}

export function TextInput({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={controlClasses(invalid, className)} {...rest} />;
}

/** Native select (keyboard + screen readers for free) with the Figma chevron on the end side. */
export function SelectInput({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, cn("cursor-pointer appearance-none pe-11", className))}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={20}
        className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-heading"
      />
    </div>
  );
}

/** Text input with a unit shown inside the field on the end side (e.g. "كجم" / "kg"). */
export function UnitInput({
  unit,
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { unit: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <input
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, cn("pe-16", className))}
        {...rest}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-body text-muted"
      >
        {unit}
      </span>
    </div>
  );
}
