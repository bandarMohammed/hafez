import type { Role } from "./types";

/** Navigation icon keys — each must exist in src/components/ui/Icon.tsx (enforced by the type check in Sidebar). */
export type IconName =
  | "dashboard"
  | "events"
  | "plus"
  | "pickup"
  | "listChecks"
  | "halls"
  | "package"
  | "charities"
  | "utensils"
  | "heart"
  | "bell"
  | "user"
  | "home"
  | "clipboard"
  | "circlePlus"
  | "shield";

export interface NavItem {
  key: string;
  href: string;
  icon: IconName;
  /** false → the route renders the "under development" state (screen designed in Figma, not built yet). */
  implemented: boolean;
  /** Extra paths (regex source, locale-free) on which this item is shown as current — e.g. C3 under "New event". */
  activePattern?: string;
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
  /** Mobile-first roles (Figma D/E/H mobile frames): nav keys shown in the bottom tab bar below 1024px. */
  mobileTabs?: string[];
  /** In-app notices page opened by the bell in the mobile app bar (Figma D/E/H). */
  noticesHref?: string;
}

const item = (key: string, href: string, icon: IconName, activePattern?: string): NavItem => ({
  key,
  href,
  icon,
  implemented: true,
  activePattern,
});

/**
 * Order = order shown in the account picker (Figma A2).
 * Adding a role's screens = flip `implemented` and add routes under src/app/[locale]/<workspace>.
 */
export const ROLE_CONFIG: readonly RoleConfig[] = [
  // B (admin) and F (judges): proposed merge into "Platform Manager" — awaiting the owner's approval.
  { role: "admin", accountId: "demo-admin", workspace: "admin", homeFrame: "B1", implemented: false, nav: [] },
  {
    role: "hall_manager",
    accountId: "demo-hall-01",
    workspace: "hall",
    homeFrame: "C1",
    implemented: true,
    nav: [
      item("home", "/hall", "dashboard"),
      item("myEvents", "/hall/events", "events", "^/hall/events/(?!new$)[^/]+(/edit)?$"),
      item("newEvent", "/hall/events/new", "plus", "^/hall/events/[^/]+/forecast$"),
      item("handovers", "/hall/handovers", "pickup"),
      item("activity", "/hall/activity", "listChecks"),
      item("profile", "/hall/profile", "halls"),
      item("notices", "/hall/notices", "bell"),
    ],
    noticesHref: "/hall/notices",
  },
  {
    role: "charity_coordinator",
    accountId: "demo-charity-01",
    workspace: "charity",
    homeFrame: "D1",
    implemented: true,
    nav: [
      item("home", "/charity", "dashboard"),
      item("opportunities", "/charity/opportunities", "package", "^/charity/opportunities/[^/]+(/decline)?$"),
      item("tasks", "/charity/tasks", "charities", "^/charity/(opportunities/[^/]+/assign|tasks/.+)$"),
      item("handovers", "/charity/handovers", "pickup", "^/charity/handovers/.+$"),
      item("listings", "/charity/listings", "utensils", "^/charity/listings/.+$"),
      item("reports", "/charity/reports", "heart", "^/charity/reports/.+$"),
      item("activity", "/charity/activity", "listChecks"),
      item("notices", "/charity/notices", "bell"),
    ],
    mobileTabs: ["home", "opportunities", "tasks", "handovers"],
    noticesHref: "/charity/notices",
  },
  {
    role: "field_representative",
    accountId: "demo-field-01",
    workspace: "field",
    homeFrame: "E1",
    implemented: true,
    nav: [
      item("tasks", "/field", "listChecks", "^/field/(tasks|reports)/.+$"),
      item("notices", "/field/notices", "bell"),
      item("profile", "/field/profile", "user"),
    ],
    mobileTabs: ["tasks", "notices", "profile"],
    noticesHref: "/field/notices",
  },
  { role: "judge_viewer", accountId: "demo-judge", workspace: "judge", homeFrame: "F1", implemented: false, nav: [] },
  {
    role: "beneficiary",
    accountId: "demo-beneficiary-01",
    workspace: "beneficiary",
    homeFrame: "H1",
    implemented: true,
    nav: [
      item("home", "/beneficiary", "home", "^/beneficiary/(food/.+|tip)$"),
      item("requests", "/beneficiary/requests", "clipboard", "^/beneficiary/requests/.+$"),
      item("report", "/beneficiary/report", "circlePlus", "^/beneficiary/reports$"),
      item("shield", "/beneficiary/shield", "shield"),
      item("notices", "/beneficiary/notices", "bell"),
    ],
    mobileTabs: ["home", "requests", "report", "shield"],
    noticesHref: "/beneficiary/notices",
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
