// Audit emission (§43, §47). Every state-changing service call should land here.

import { db } from "../db";
import { id, now } from "../utils/ids";
import type { ActorContext } from "@/types/platform";

export async function emitAudit(
  ctx: ActorContext,
  action: string,
  subject?: { type?: string | null; id?: string | null },
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.auditEvents.insert({
    id: id("audit"),
    tenantId: ctx.tenantId,
    actorUserId: ctx.actorUserId ?? null,
    action,
    subjectType: subject?.type ?? null,
    subjectId: subject?.id ?? null,
    metadata,
    createdAt: now(),
  });
}

export async function listAudit(tenantId: string): ReturnType<typeof db.auditEvents.list> {
  return (await db.auditEvents.list(tenantId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
