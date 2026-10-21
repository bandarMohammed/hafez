import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Figma component "Button": Style = Primary | Secondary | Ghost | Danger; min height 48 (touch target ≥ 44). */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover",
  secondary: "bg-surface text-action border-[1.5px] border-action hover:bg-selected hover:text-heading",
  ghost: "bg-transparent text-action hover:bg-selected hover:text-heading",
  danger: "bg-danger text-on-action hover:bg-danger-hover",
};

export function buttonClasses(variant: ButtonVariant = "primary", fullWidth = false, className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 py-3 text-button whitespace-nowrap",
    "transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-muted",
    VARIANT[variant],
    fullWidth && "w-full",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant = "primary", fullWidth, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, fullWidth, className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; fullWidth?: boolean };

/** Navigation that looks like a button (keeps link semantics for keyboard/screen readers). */
export function ButtonLink({ variant = "primary", fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, fullWidth, className)} {...rest} />;
}
