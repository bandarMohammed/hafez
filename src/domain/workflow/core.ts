import type { ActivityAction, ActivityLogEntry, DemoDataset, DemoUser, EntityType, Notice, NoticeKind } from "../types";

/**
 * Workflow commands (blueprint §5 "What happens when a button is pressed"):
 * 1) validate the input, 2) check the role & record scope with `can()`, 3) update the data through one
 * function, 4) add an activity entry, 5) return a clear success message — or an error and no change.
 * Commands are pure: (context, input) → result. The store persists `data` only when `ok`.
 */

export interface CommandContext {
  data: DemoDataset;
  user: DemoUser;
  now: Date;
}

/** One-time confirmation for the next screen. `key` is a message path under `flash`. */
export interface FlashMessage {
  key: string;
  values?: Record<string, string | number>;
}

export type CommandError =
  "not_allowed" | "not_found" | "invalid_state" | "validation" | "over_limit" | "over_remaining" | "duplicate";

export type CommandResult<T = undefined> =
  | { ok: true; data: DemoDataset; flash?: FlashMessage; value: T }
  | { ok: false; error: CommandError; fields?: Record<string, string> };

export const fail = (error: CommandError, fields?: Record<string, string>): CommandResult<never> => ({
  ok: false,
  error,
  fields,
});

export function ok<T = undefined>(data: DemoDataset, flash?: FlashMessage, value?: T): CommandResult<T> {
  return { ok: true, data, flash, value: value as T };
}

/** Sequential ids per prefix: "N-" + max+1 (keeps the demo ids readable). */
export function nextId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => {
    const n = new RegExp(`^${prefix}-(\\d+)`).exec(id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

export function logActivity(
  data: DemoDataset,
  e: {
    actor: DemoUser;
    action: ActivityAction;
    entityType: EntityType;
    entityId: string;
    at: Date;
    before: string | null;
    after: string | null;
  },
): DemoDataset {
  const entry: ActivityLogEntry = {
    id: `${nextId(
      "A",
      data.activity.map((a) => a.id),
    )}-${e.entityId}`,
    actorUserId: e.actor.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    timestamp: e.at.toISOString(),
    before: e.before,
    after: e.after,
  };
  return { ...data, activity: [...data.activity, entry] };
}

export function notify(
  data: DemoDataset,
  recipients: string[],
  kind: NoticeKind,
  params: Notice["params"],
  link: string | null,
  at: Date,
): DemoDataset {
  let notices = data.notices;
  for (const recipientUserId of new Set(recipients)) {
    notices = [
      ...notices,
      {
        id: nextId(
          "N",
          notices.map((n) => n.id),
        ),
        recipientUserId,
        kind,
        params,
        link,
        createdAt: at.toISOString(),
        readAt: null,
      },
    ];
  }
  return { ...data, notices };
}

export const replaceById = <T extends { id: string }>(list: T[], item: NoInfer<T>): T[] =>
  list.map((x) => (x.id === item.id ? item : x));

/** Users of a role in an organisation (e.g. the coordinators of a charity, the managers of a hall). */
export const usersOf = (data: DemoDataset, role: DemoUser["role"], organizationId?: string | null) =>
  data.users.filter((u) => u.role === role && (organizationId === undefined || u.organizationId === organizationId));

/** Strict ISO check used by command inputs. */
export const isIso = (s: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s));
