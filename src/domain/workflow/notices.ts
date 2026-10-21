import { fail, ok, replaceById } from "./core";
import type { CommandContext, CommandResult } from "./core";

/** In-app notices (Figma E6) — every role reads only its own. */

export function markNoticeRead({ data, user, now }: CommandContext, noticeId: string): CommandResult {
  const n = data.notices.find((x) => x.id === noticeId);
  if (!n || n.recipientUserId !== user.id) return fail("not_found");
  if (n.readAt) return ok(data);
  return ok({ ...data, notices: replaceById(data.notices, { ...n, readAt: now.toISOString() }) });
}

export function markAllNoticesRead({ data, user, now }: CommandContext): CommandResult {
  const at = now.toISOString();
  return ok({
    ...data,
    notices: data.notices.map((n) => (n.recipientUserId === user.id && !n.readAt ? { ...n, readAt: at } : n)),
  });
}
