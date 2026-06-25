// Notification engine (§36). Rule-matched, deduped, audited delivery. External
// channels require an allowlisted destination (§47).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { renderTemplate } from "@/lib/aiops/prompts/prompt-service";
import type { ActorContext } from "@/types/platform";
import type { Notification, NotificationChannel, NotificationRule } from "@/types/mission-control";

// Process-level allowlist of external destinations (§47 — non in_app channels).
const allowlist = new Set<string>();

export function allowDestination(destination: string): void {
  allowlist.add(destination);
}

export async function createNotificationRule(
  ctx: ActorContext,
  input: {
    name: string;
    eventKey: string;
    channel: NotificationChannel;
    template: string;
    destination?: string;
    recipientRole?: string;
  },
): Promise<NotificationRule> {
  requirePermission(ctx, "notifications.manage");
  return await db.notificationRules.insert({
    id: id("nrule"),
    tenantId: ctx.tenantId,
    name: input.name,
    eventKey: input.eventKey,
    channel: input.channel,
    destination: input.destination ?? null,
    recipientRole: input.recipientRole ?? null,
    template: input.template,
    enabled: true,
    createdAt: now(),
  });
}

/** Fire an event; matching enabled rules render + deliver notifications. */
export async function emitEvent(
  ctx: ActorContext,
  eventKey: string,
  recipientUserId: string,
  vars: Record<string, unknown>,
  deepLink?: string,
): Promise<Notification[]> {
  const rules = await db.notificationRules.list(
    ctx.tenantId,
    (r) => r.enabled && r.eventKey === eventKey,
  );
  const out: Notification[] = [];
  for (const rule of rules) {
    const body = renderTemplate(rule.template, vars);
    const dedupeKey = `${rule.id}:${recipientUserId}:${eventKey}:${vars.subjectId ?? ""}`;

    // Dedupe: suppress identical pending/sent notifications.
    const duplicate = await db.notifications.find(
      ctx.tenantId,
      (n) => n.dedupeKey === dedupeKey && n.state !== "failed",
    );
    if (duplicate) {
      out.push(duplicate);
      continue;
    }

    const blocked =
      rule.channel !== "in_app" && (!rule.destination || !allowlist.has(rule.destination));

    const notification = await db.notifications.insert({
      id: id("notif"),
      tenantId: ctx.tenantId,
      ruleId: rule.id,
      recipientUserId,
      title: `${eventKey}`,
      body,
      channel: rule.channel,
      state: blocked ? "failed" : "sent",
      deepLink: deepLink ?? null,
      dedupeKey,
      error: blocked ? "destination not allowlisted" : null,
      createdAt: now(),
    });
    await emitAudit(ctx, "notifications.deliver", { type: "notification", id: notification.id }, {
      eventKey,
      channel: rule.channel,
      state: notification.state,
    });
    out.push(notification);
  }
  return out;
}

export async function listNotifications(ctx: ActorContext, recipientUserId?: string): Promise<Notification[]> {
  return (await db.notifications
    .list(ctx.tenantId, recipientUserId ? (n) => n.recipientUserId === recipientUserId : undefined))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
