import { cn } from "@/lib/cn";

/** Loading placeholder (Figma G1 "Skeleton Card"). Purely visual; the live region announces loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-xs bg-surface-alt", className)} />;
}
