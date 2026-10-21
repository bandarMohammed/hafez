"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FOOD_TYPES } from "@/domain/types";
import type { FoodType } from "@/domain/types";
import { cn } from "@/lib/cn";
import { controlClasses } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

/**
 * Figma C2 "Expected food type" dropdown — several types can be chosen ("Hot meals, desserts").
 * A button opens a panel of real checkboxes (native semantics); Escape or clicking outside closes it
 * and returns focus to the button.
 */
export function FoodTypePicker({
  id,
  labelId,
  value,
  onChange,
  invalid,
  describedById,
}: {
  id: string;
  labelId: string;
  value: FoodType[];
  onChange: (next: FoodType[]) => void;
  invalid?: boolean;
  describedById?: string;
}) {
  const t = useTranslations("newEvent");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (type: FoodType) =>
    onChange(
      value.includes(type)
        ? value.filter((v) => v !== type)
        : FOOD_TYPES.filter((f) => f === type || value.includes(f)),
    );

  const summary = value.map((v) => t(`foodTypes.${v}`)).join(locale === "ar" ? "، " : ", ");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${id}`}
        aria-describedby={describedById}
        onClick={() => setOpen((o) => !o)}
        className={controlClasses(invalid, "flex cursor-pointer items-center justify-between gap-3 text-start")}
      >
        <span className={cn("truncate", !summary && "text-muted")}>{summary || t("placeholders.foodTypes")}</span>
        <Icon name="chevronDown" size={20} className="shrink-0 text-heading" />
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-labelledby={labelId}
          className="absolute inset-x-0 top-full z-20 mt-2 rounded-md border border-line bg-surface p-2 shadow-raised"
        >
          <ul className="flex flex-col">
            {FOOD_TYPES.map((type) => (
              <li key={type}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 hover:bg-selected">
                  <input
                    type="checkbox"
                    checked={value.includes(type)}
                    onChange={() => toggle(type)}
                    className="size-5 accent-[var(--color-action)]"
                  />
                  <span className="text-body text-ink">{t(`foodTypes.${type}`)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
