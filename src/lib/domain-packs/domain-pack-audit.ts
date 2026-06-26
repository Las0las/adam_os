// Phase 8 — domain pack audit helpers. Thin wrappers over emitAudit so every
// install/uninstall/demo lifecycle event is recorded consistently.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";

export async function auditPackInstalled(
  ctx: ActorContext,
  installationId: string,
  packKey: string,
  packVersion: string,
): Promise<void> {
  await emitAudit(ctx, "domain_pack.installed", { type: "domain_pack_installation", id: installationId }, {
    packKey,
    packVersion,
  });
}

export async function auditPackUninstalled(
  ctx: ActorContext,
  installationId: string,
  packKey: string,
  removeDemoData: boolean,
): Promise<void> {
  await emitAudit(ctx, "domain_pack.uninstalled", { type: "domain_pack_installation", id: installationId }, {
    packKey,
    removeDemoData,
  });
}
