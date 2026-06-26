// Phase 8 — domain pack uninstaller. Safe mode (default) only marks the
// installation uninstalled — it NEVER deletes customer-created objects. Demo
// objects (properties.__demo === true && __packKey === pack) are removed only
// when removeDemoData is explicitly requested.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { auditPackUninstalled } from "./domain-pack-audit";
import type { ActorContext } from "@/types/platform";
import type { DomainPackInstallation } from "./domain-pack-types";

export interface UninstallResult {
  installation: DomainPackInstallation;
  removedDemoObjects: number;
}

export async function uninstallDomainPack(
  ctx: ActorContext,
  packKey: string,
  opts: { removeDemoData?: boolean } = {},
): Promise<UninstallResult> {
  requirePermission(ctx, "dataops.admin");

  const installation = await db.domainPackInstallations.find(
    ctx.tenantId,
    (i) => i.packKey === packKey && i.status === "installed",
  );
  if (!installation) throw new Error(`pack not installed: ${packKey}`);

  let removedDemoObjects = 0;
  if (opts.removeDemoData) {
    // Remove ONLY demo objects owned by this pack — never customer objects.
    const demoObjects = await db.ontologyObjects.list(
      ctx.tenantId,
      (o) => o.properties.__demo === true && o.properties.__packKey === packKey,
    );
    for (const obj of demoObjects) {
      await db.ontologyObjects.delete(ctx.tenantId, obj.id);
      removedDemoObjects += 1;
    }
  }

  const updated = await db.domainPackInstallations.update(installation.id, {
    status: "uninstalled",
    uninstalledAt: now(),
  });

  await auditPackUninstalled(ctx, installation.id, packKey, opts.removeDemoData === true);
  return { installation: updated, removedDemoObjects };
}
