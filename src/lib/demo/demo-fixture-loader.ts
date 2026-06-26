// Phase 8 — demo fixture loader. Ensures a pack's demo objects exist (installing
// the pack on demand), returning the demo object count. All demo objects carry
// properties.__demo = true.

import { db } from "@/lib/lawrence-core/db";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import type { ActorContext } from "@/types/platform";

export async function countDemoObjects(ctx: ActorContext, packKey: string): Promise<number> {
  return (
    await db.ontologyObjects.list(
      ctx.tenantId,
      (o) => o.properties.__demo === true && o.properties.__packKey === packKey,
    )
  ).length;
}

export async function ensureDemoObjects(ctx: ActorContext, packKey: string): Promise<number> {
  let count = await countDemoObjects(ctx, packKey);
  if (count === 0) {
    const manifest = getDomainPackManifest(packKey);
    if (manifest) {
      await installDomainPack(ctx, manifest, { actorUserId: ctx.actorUserId });
      count = await countDemoObjects(ctx, packKey);
    }
  }
  return count;
}
