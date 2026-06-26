// Phase 8 — demo run trace reads. Demo run traces are real per-step results
// recorded by the runner (no synthetic traces).

import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";
import type { DomainPackDemoRun } from "@/lib/domain-packs/domain-pack-types";

export async function listDemoRuns(
  ctx: ActorContext,
  filters: { packKey?: string; demoKey?: string } = {},
): Promise<DomainPackDemoRun[]> {
  return (
    await db.domainPackDemoRuns.list(ctx.tenantId, (r) => {
      if (filters.packKey && r.packKey !== filters.packKey) return false;
      if (filters.demoKey && r.demoKey !== filters.demoKey) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDemoRun(
  ctx: ActorContext,
  demoRunId: string,
): Promise<DomainPackDemoRun | undefined> {
  return await db.domainPackDemoRuns.get(ctx.tenantId, demoRunId);
}
