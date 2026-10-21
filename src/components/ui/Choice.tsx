"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Figma "Radio Option Card" — a native radio group styled as cards (title + description).
 * Native inputs keep keyboard (arrow keys) and screen-reader behaviour.
 */
export function RadioCards<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  error,
  errorId,
  required,
}: {
  name: string;
  legend: string;
  value: T | null;
  options: Array<{ value: T; title: string; description?: string; disabled?: boolean }>;
  onChange: (v: T) => void;
  error?: string;
  errorId?: string;
  required?: boolean;
}) {
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-3">
      <legend className="mb-2 text-small-strong text-heading">
        {legend}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-4 transition-colors",
              checked ? "border-[1.5px] border-action bg-selected" : "border-line hover:border-line-strong",
              error && !checked && "border-danger",
              o.disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-1 size-5 shrink-0 accent-[var(--color-action)]"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-body-strong text-heading">{o.title}</span>
              {o.description ? <span className="text-small text-muted">{o.description}</span> : null}
            </span>
          </label>
        );
      })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-danger">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

/** Figma "Checkbox" (RTL/LTR) — native checkbox with a large hit area. */
export function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-action)]"
      />
      <span className="text-small text-ink">{children}</span>
    </label>
  );
}

/**
 * Figma "Filter Chip" row — behaves as a single-choice toggle group (aria-pressed), used for list filters.
 */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-small-strong transition-colors",
              active
                ? "border-action bg-selected text-heading"
                : "border-line bg-surface text-muted hover:text-heading",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
