// Notification engine (§36). Rule-matched, deduped, audited delivery. External
// channels require an allowlisted destination (§47).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { renderTemplate } from "@/lib/aiops/prompts/prompt-service";
import { getChannelAdapter } from "./channels/channel-registry";
import type { ActorContext } from "@/types/platform";
import type { Notification, NotificationChannel, NotificationRule } from "@/types/mission-control";

// Process-level allowlist of external destinations (§47 — non in_app channels).
const allowlist = new Set<string>();

export function allowDestination(destination: string): void {
  allowlist.add(destination);
}

interface DispatchInput {
  title: string;
  body: string;
  destination: string | null;
  deepLink: string | null;
}

/**
 * Route one rule's notification to its channel and return the resulting state.
 *
 *  - in_app:            always delivered (the stored row is the delivery).
 *  - external channels: transmitted only when the destination is allowlisted
 *                       (§47) AND a channel adapter is configured. Otherwise we
 *                       record an internal notification only (state "queued") —
 *                       never silently dropping or failing the event.
 *  - external send:     "sent" on success, "failed" with the transport error.
 */
async function dispatch(
  rule: NotificationRule,
  input: DispatchInput,
): Promise<{ state: Notification["state"]; error: string | null }> {
  if (rule.channel === "in_app") return { state: "sent", error: null };

  const adapter = getChannelAdapter(rule.channel);
  const destinationOk = Boolean(input.destination) && allowlist.has(input.destination ?? "");

  if (!destinationOk) {
    return { state: "queued", error: "destination not allowlisted — queued internally only" };
  }
  if (!adapter.isConfigured()) {
    return {
      state: "queued",
      error: `${rule.channel} adapter not configured — queued internally only`,
    };
  }

  const result = await adapter.send({
    title: input.title,
    body: input.body,
    destination: input.destination as string,
    deepLink: input.deepLink,
  });
  return result.ok
    ? { state: "sent", error: null }
    : { state: "failed", error: result.error ?? "external delivery failed" };
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

    const title = `${eventKey}`;
    const { state, error } = await dispatch(rule, {
      title,
      body,
      destination: rule.destination ?? null,
      deepLink: deepLink ?? null,
    });

    const notification = await db.notifications.insert({
      id: id("notif"),
      tenantId: ctx.tenantId,
      ruleId: rule.id,
      recipientUserId,
      title,
      body,
      channel: rule.channel,
      state,
      deepLink: deepLink ?? null,
      dedupeKey,
      error,
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
