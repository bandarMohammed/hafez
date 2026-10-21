import { cn } from "@/lib/cn";

/** Figma "Avatar": initials only — no photos of real people (blueprint §11). Decorative: the name is always shown next to it. */
export function Avatar({ initials, size = 36, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-selected text-small-strong text-heading",
        className,
      )}
    >
      {initials}
    </span>
  );
}
