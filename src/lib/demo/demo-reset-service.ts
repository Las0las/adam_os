// Phase 8 — demo reset. Removes ONLY demo objects (properties.__demo === true)
// owned by a pack, and optionally the pack's demo runs. Never touches
// user-created records. Emits audit demo.reset.completed.

import { db } from "@/lib/lawrence-core/db";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";

export interface DemoResetResult {
  removedObjects: number;
  removedRuns: number;
}

export async function resetDemo(
  ctx: ActorContext,
  packKey: string,
  opts: { removeTraces?: boolean } = {},
): Promise<DemoResetResult> {
  requirePermission(ctx, "dataops.admin");

  const demoObjects = await db.ontologyObjects.list(
    ctx.tenantId,
    (o) => o.properties.__demo === true && o.properties.__packKey === packKey,
  );
  let removedObjects = 0;
  for (const obj of demoObjects) {
    await db.ontologyObjects.delete(ctx.tenantId, obj.id);
    removedObjects += 1;
  }

  let removedRuns = 0;
  if (opts.removeTraces) {
    const runs = await db.domainPackDemoRuns.list(ctx.tenantId, (r) => r.packKey === packKey);
    for (const r of runs) {
      await db.domainPackDemoRuns.delete(ctx.tenantId, r.id);
      removedRuns += 1;
    }
  }

  await emitAudit(ctx, "demo.reset.completed", { type: "domain_pack", id: packKey }, {
    packKey,
    removedObjects,
    removedRuns,
  });
  return { removedObjects, removedRuns };
}
