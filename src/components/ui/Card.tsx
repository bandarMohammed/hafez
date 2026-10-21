import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Surface card used by panels (Figma: radius/lg, border/default, white surface). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...rest} />;
}

/** Titled panel (Figma "Panel/*" frames: padding 24, gap 16). */
export function Panel({
  title,
  titleId,
  children,
  className,
}: {
  title: ReactNode;
  titleId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={titleId} className={cn("rounded-lg border border-line bg-surface p-6", className)}>
      <h2 id={titleId} className="mb-4 text-h4 text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}
