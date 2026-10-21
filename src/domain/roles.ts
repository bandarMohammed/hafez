import type { Role } from "./types";

/** Navigation icon keys — each must exist in src/components/ui/Icon.tsx (enforced by the type check in Sidebar). */
export type IconName = "dashboard" | "events" | "plus" | "pickup" | "listChecks" | "halls";

export interface NavItem {
  key: string;
  href: string;
  icon: IconName;
  /** false → the route renders the "under development" state (screen designed in Figma, not built yet). */
  implemented: boolean;
}

export interface RoleConfig {
  role: Role;
  /** Demo account that represents this role (blueprint §10 seed accounts + v1.1 beneficiary). */
  accountId: string;
  /** URL segment of the role workspace, e.g. /ar/hall */
  workspace: string;
  /** Figma frame code of the role home, for traceability. */
  homeFrame: string;
  implemented: boolean;
  nav: NavItem[];
}

/**
 * Order = order shown in the account picker (Figma A2).
 * Adding a role's screens = flip `implemented` and add routes under src/app/[locale]/<workspace>.
 */
export const ROLE_CONFIG: readonly RoleConfig[] = [
  { role: "admin", accountId: "demo-admin", workspace: "admin", homeFrame: "B1", implemented: false, nav: [] },
  {
    role: "hall_manager",
    accountId: "demo-hall-01",
    workspace: "hall",
    homeFrame: "C1",
    implemented: true,
    nav: [
      { key: "home", href: "/hall", icon: "dashboard", implemented: true },
      { key: "myEvents", href: "/hall/events", icon: "events", implemented: false },
      { key: "newEvent", href: "/hall/events/new", icon: "plus", implemented: true },
      { key: "handovers", href: "/hall/handovers", icon: "pickup", implemented: false },
      { key: "activity", href: "/hall/activity", icon: "listChecks", implemented: false },
      { key: "profile", href: "/hall/profile", icon: "halls", implemented: false },
    ],
  },
  {
    role: "charity_coordinator",
    accountId: "demo-charity-01",
    workspace: "charity",
    homeFrame: "D1",
    implemented: false,
    nav: [],
  },
  {
    role: "field_representative",
    accountId: "demo-field-01",
    workspace: "field",
    homeFrame: "E1",
    implemented: false,
    nav: [],
  },
  { role: "judge_viewer", accountId: "demo-judge", workspace: "judge", homeFrame: "F1", implemented: false, nav: [] },
  {
    role: "beneficiary",
    accountId: "demo-beneficiary-01",
    workspace: "beneficiary",
    homeFrame: "H1",
    implemented: false,
    nav: [],
  },
];

export function getRoleConfig(role: Role): RoleConfig {
  const config = ROLE_CONFIG.find((c) => c.role === role);
  if (!config) throw new Error(`Unknown role: ${role}`);
  return config;
}

export function getRoleByWorkspace(workspace: string): RoleConfig | undefined {
  return ROLE_CONFIG.find((c) => c.workspace === workspace);
}

export function homePathFor(role: Role): string {
  return `/${getRoleConfig(role).workspace}`;
}
