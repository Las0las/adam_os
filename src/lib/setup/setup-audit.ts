// Phase 9 — setup audit helper.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";

export async function auditSetup(
  ctx: ActorContext,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await emitAudit(ctx, action, { type: "tenant", id: ctx.tenantId }, metadata);
}
