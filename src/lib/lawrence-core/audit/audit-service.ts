// Audit emission (§43, §47). Every state-changing service call should land here.

import { db } from "../db";
import { id, now } from "../utils/ids";
import { computeEventHash } from "./audit-hash-service";
import type { ActorContext, AuditEvent } from "@/types/platform";

/** Latest event hash for a tenant — the tail of the hash chain. */
async function latestEventHash(tenantId: string): Promise<string | null> {
  const events = await db.auditEvents.list(tenantId);
  if (events.length === 0) return null;
  const latest = events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
  return latest.eventHash ?? null;
}

export async function emitAudit(
  ctx: ActorContext,
  action: string,
  subject?: { type?: string | null; id?: string | null },
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const createdAt = now();
  const previousHash = await latestEventHash(ctx.tenantId);
  const base = {
    tenantId: ctx.tenantId,
    action,
    subjectType: subject?.type ?? null,
    subjectId: subject?.id ?? null,
    metadata,
    createdAt,
  };
  const eventHash = computeEventHash(base, previousHash);
  // Audit events are append-only: there is intentionally no update/delete helper.
  await db.auditEvents.insert({
    id: id("audit"),
    actorUserId: ctx.actorUserId ?? null,
    ...base,
    previousHash,
    eventHash,
    integrityVersion: 1,
  } satisfies AuditEvent);
}

export async function listAudit(tenantId: string): ReturnType<typeof db.auditEvents.list> {
  return (await db.auditEvents.list(tenantId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
