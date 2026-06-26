// Phase 9 — integration audit helpers. Never include secret values in metadata.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";

export async function auditIntegration(
  ctx: ActorContext,
  action: string,
  connectionId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await emitAudit(ctx, action, { type: "integration_connection", id: connectionId }, metadata);
}
