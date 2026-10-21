import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Icons used in Figma: Hafez brand icons (brand/assets/icons, 24 grid, 1.75 stroke) and
 * Lucide UI icons (ISC licence, stroke adjusted to 1.75 — see THIRD_PARTY_NOTICES.md).
 * Colour always follows `currentColor`.
 */
const PATHS = {
  // brand
  events: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  halls: <path d="M3.5 20.5h17M5 9.5h14M4.5 9.5 12 4l7.5 5.5M7 12.5v5M10.3 12.5v5M13.7 12.5v5M17 12.5v5" />,
  charities: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 19.5c0-3.1 2.5-5.3 5.5-5.3s5.5 2.2 5.5 5.3" />
      <circle cx="5.5" cy="10" r="2" />
      <circle cx="18.5" cy="10" r="2" />
      <path d="M2.5 18c0-2.1 1.2-3.5 3-3.8M21.5 18c0-2.1-1.2-3.5-3-3.8" />
    </>
  ),
  pickup: (
    <>
      <path d="M3 6.5h10.5v10H3zM13.5 10h4l3.5 3.6v2.9h-7.5" />
      <circle cx="7" cy="17.5" r="2" fill="var(--icon-bg, #fff)" />
      <circle cx="17.2" cy="17.5" r="2" fill="var(--icon-bg, #fff)" />
    </>
  ),
  foodSurplus: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9M8 5.25l8 4.5" />
    </>
  ),
  weight: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M6.2 9h11.6l2.2 10.5a1 1 0 0 1-1 1.2H5a1 1 0 0 1-1-1.2z" />
      <path d="M9.5 15h5" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  // lucide (ISC)
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  plus: <path d="M5 12h14M12 5v14" />,
  listChecks: <path d="M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4" />,
  chevronForward: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  menu: <path d="M4 5h16M4 12h16M4 19h16" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconKey = keyof typeof PATHS;

/** Icons that point "forward" and must mirror in RTL. */
const DIRECTIONAL: ReadonlySet<IconKey> = new Set(["chevronForward"]);

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconKey;
  size?: number;
}

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", DIRECTIONAL.has(name) && "rtl:-scale-x-100", className)}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
