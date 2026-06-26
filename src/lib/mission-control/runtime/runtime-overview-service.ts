// Phase 6 — Mission Control overview. Assembles the governance + deployment
// control-plane snapshot: environments, releases, pending approvals, runtime
// components, active kill switches, recent health, incidents, and metrics.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { listEnvironments } from "./environment-repository";
import { listReleaseBundles } from "./release-repository";
import { listPendingApprovals } from "./approval-repository";
import { listRuntimeComponents } from "./runtime-component-repository";
import { listActiveKillSwitches } from "./kill-switch-repository";
import { listRecentHealthChecks } from "./health-check-repository";
import type { ActorContext } from "@/types/platform";
import type { MissionControlOverview } from "./mission-control-hardening-types";

function withinHours(ts: string | null | undefined, hours: number, refMs: number): boolean {
  if (!ts) return false;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return false;
  return refMs - t <= hours * 3_600_000;
}

export async function getMissionControlOverview(
  ctx: ActorContext,
): Promise<MissionControlOverview> {
  const refMs = Date.parse(now());

  const [
    environments,
    releases,
    pendingApprovals,
    runtimeComponents,
    activeKillSwitches,
    recentHealthChecks,
    runtimeIncidents,
  ] = await Promise.all([
    listEnvironments(ctx.tenantId),
    listReleaseBundles(ctx.tenantId),
    listPendingApprovals(ctx.tenantId),
    listRuntimeComponents(ctx.tenantId),
    listActiveKillSwitches(ctx.tenantId),
    listRecentHealthChecks(ctx.tenantId, 50),
    db.runtimeIncidents.list(ctx.tenantId, (i) => i.status !== "resolved"),
  ]);

  const metrics = {
    pendingApprovals: pendingApprovals.length,
    promotedReleases24h: releases.filter(
      (r) => r.status === "promoted" && withinHours(r.promotedAt, 24, refMs),
    ).length,
    failedReleases7d: releases.filter(
      (r) => r.status === "failed" && withinHours(r.createdAt, 24 * 7, refMs),
    ).length,
    activeKillSwitches: activeKillSwitches.length,
    degradedComponents: runtimeComponents.filter((c) => c.status === "degraded").length,
    failedComponents: runtimeComponents.filter((c) => c.status === "failed").length,
  };

  return {
    environments,
    releases: releases.slice(0, 50),
    pendingApprovals,
    runtimeComponents,
    activeKillSwitches,
    recentHealthChecks,
    runtimeIncidents: runtimeIncidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    metrics,
  };
}
