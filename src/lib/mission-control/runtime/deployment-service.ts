// Deployments / releases / runtime (§38–§39). Draft -> staging -> production
// promotion with approval gates, plus rollback and runtime health.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import type { DeploymentEnvironment, ReleaseBundle, RuntimeIncident } from "@/types/mission-control";

const PROMOTION_PATH: Record<DeploymentEnvironment, DeploymentEnvironment | null> = {
  draft: "staging",
  staging: "production",
  production: null,
};

export async function createRelease(
  ctx: ActorContext,
  input: { name: string; artifacts: ReleaseBundle["artifacts"] },
): Promise<ReleaseBundle> {
  requirePermission(ctx, "mission_control.admin");
  return await db.releaseBundles.insert({
    id: id("rel"),
    tenantId: ctx.tenantId,
    name: input.name,
    artifacts: input.artifacts,
    environment: "draft",
    status: "draft",
    promotedFrom: null,
    createdAt: now(),
  });
}

export async function promoteRelease(ctx: ActorContext, releaseId: string): Promise<ReleaseBundle> {
  requirePermission(ctx, "deploy.promote");
  const release = await db.releaseBundles.get(ctx.tenantId, releaseId);
  if (!release) throw new Error(`Release not found: ${releaseId}`);
  const next = PROMOTION_PATH[release.environment];
  if (!next) throw new Error(`Release already in production: ${releaseId}`);
  const updated = await db.releaseBundles.update(release.id, {
    environment: next,
    status: "deployed",
    promotedFrom: release.environment,
  });
  await emitAudit(ctx, "deploy.promote", { type: "deployment_release", id: release.id }, {
    from: release.environment,
    to: next,
  });
  return updated;
}

export async function rollbackRelease(ctx: ActorContext, releaseId: string): Promise<ReleaseBundle> {
  requirePermission(ctx, "deploy.promote");
  const release = await db.releaseBundles.get(ctx.tenantId, releaseId);
  if (!release) throw new Error(`Release not found: ${releaseId}`);
  const updated = await db.releaseBundles.update(release.id, {
    status: "rolled_back",
    environment: release.promotedFrom ?? release.environment,
  });
  await emitAudit(ctx, "deploy.rollback", { type: "deployment_release", id: release.id }, {});
  return updated;
}

export async function raiseIncident(
  ctx: ActorContext,
  input: { title: string; severity: RuntimeIncident["severity"]; source: string; detail?: string },
): Promise<RuntimeIncident> {
  const incident = await db.runtimeIncidents.insert({
    id: id("inc"),
    tenantId: ctx.tenantId,
    title: input.title,
    severity: input.severity,
    status: "open",
    source: input.source,
    detail: input.detail ?? null,
    createdAt: now(),
  });
  await emitAudit(ctx, "runtime.incident.raise", { type: "runtime_incident", id: incident.id }, {
    severity: input.severity,
  });
  return incident;
}

export interface RuntimeHealth {
  pipelineFailureRate: number;
  functionFailureRate: number;
  actionFailureRate: number;
  notificationFailureRate: number;
  openIncidents: number;
  reviewBacklog: number;
}

export async function runtimeHealth(ctx: ActorContext): Promise<RuntimeHealth> {
  const rate = <T>(rows: T[], get: (r: T) => string, failStates: string[]) =>
    rows.length ? rows.filter((r) => failStates.includes(get(r))).length / rows.length : 0;
  const [pipelineRuns, functionRuns, actionExecutions, notifications, openIncidents, reviewBacklog] =
    await Promise.all([
      db.pipelineRuns.list(ctx.tenantId),
      db.functionRuns.list(ctx.tenantId),
      db.actionExecutions.list(ctx.tenantId),
      db.notifications.list(ctx.tenantId),
      db.runtimeIncidents.list(ctx.tenantId, (i) => i.status === "open"),
      db.reviewCases.list(ctx.tenantId, (c) => c.status === "open"),
    ]);
  return {
    pipelineFailureRate: rate(pipelineRuns, (r) => r.status, ["failed"]),
    functionFailureRate: rate(functionRuns, (r) => r.status, ["failed"]),
    actionFailureRate: rate(actionExecutions, (r) => r.status, ["failed"]),
    notificationFailureRate: rate(notifications, (r) => r.state, ["failed"]),
    openIncidents: openIncidents.length,
    reviewBacklog: reviewBacklog.length,
  };
}
