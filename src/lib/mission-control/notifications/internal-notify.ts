// Phase 6 — internal notification helper. Queues an in-app notification row
// directly (no external transport), used by governance services to notify
// approvers/admins/requesters. In-app notifications are always delivered as the
// stored row, so state is "sent". External fan-out remains the channel-adapter
// path in notification-service.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { Notification } from "@/types/mission-control";

export async function queueInternalNotification(
  ctx: ActorContext,
  input: { recipientUserId: string; title: string; body: string; deepLink?: string | null },
): Promise<Notification> {
  return await db.notifications.insert({
    id: id("notif"),
    tenantId: ctx.tenantId,
    ruleId: null,
    recipientUserId: input.recipientUserId,
    title: input.title,
    body: input.body,
    channel: "in_app",
    state: "sent",
    deepLink: input.deepLink ?? null,
    dedupeKey: null,
    error: null,
    createdAt: now(),
  });
}

/** Queue an in-app notification to every admin-capable user in the tenant. */
export async function notifyAdmins(
  ctx: ActorContext,
  input: { title: string; body: string; deepLink?: string | null },
): Promise<Notification[]> {
  const users = await db.users.list(ctx.tenantId);
  const recipients = users.length ? users.map((u) => u.id) : ["system"];
  const out: Notification[] = [];
  for (const recipientUserId of recipients) {
    out.push(await queueInternalNotification(ctx, { recipientUserId, ...input }));
  }
  return out;
}
