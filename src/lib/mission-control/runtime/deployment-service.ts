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

export function createRelease(
  ctx: ActorContext,
  input: { name: string; artifacts: ReleaseBundle["artifacts"] },
): ReleaseBundle {
  requirePermission(ctx, "mission_control.admin");
  return db.releaseBundles.insert({
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

export function promoteRelease(ctx: ActorContext, releaseId: string): ReleaseBundle {
  requirePermission(ctx, "deploy.promote");
  const release = db.releaseBundles.get(ctx.tenantId, releaseId);
  if (!release) throw new Error(`Release not found: ${releaseId}`);
  const next = PROMOTION_PATH[release.environment];
  if (!next) throw new Error(`Release already in production: ${releaseId}`);
  const updated = db.releaseBundles.update(release.id, {
    environment: next,
    status: "deployed",
    promotedFrom: release.environment,
  });
  emitAudit(ctx, "deploy.promote", { type: "deployment_release", id: release.id }, {
    from: release.environment,
    to: next,
  });
  return updated;
}

export function rollbackRelease(ctx: ActorContext, releaseId: string): ReleaseBundle {
  requirePermission(ctx, "deploy.promote");
  const release = db.releaseBundles.get(ctx.tenantId, releaseId);
  if (!release) throw new Error(`Release not found: ${releaseId}`);
  const updated = db.releaseBundles.update(release.id, {
    status: "rolled_back",
    environment: release.promotedFrom ?? release.environment,
  });
  emitAudit(ctx, "deploy.rollback", { type: "deployment_release", id: release.id }, {});
  return updated;
}

export function raiseIncident(
  ctx: ActorContext,
  input: { title: string; severity: RuntimeIncident["severity"]; source: string; detail?: string },
): RuntimeIncident {
  const incident = db.runtimeIncidents.insert({
    id: id("inc"),
    tenantId: ctx.tenantId,
    title: input.title,
    severity: input.severity,
    status: "open",
    source: input.source,
    detail: input.detail ?? null,
    createdAt: now(),
  });
  emitAudit(ctx, "runtime.incident.raise", { type: "runtime_incident", id: incident.id }, {
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

export function runtimeHealth(ctx: ActorContext): RuntimeHealth {
  const rate = <T>(rows: T[], get: (r: T) => string, failStates: string[]) =>
    rows.length ? rows.filter((r) => failStates.includes(get(r))).length / rows.length : 0;
  return {
    pipelineFailureRate: rate(db.pipelineRuns.list(ctx.tenantId), (r) => r.status, ["failed"]),
    functionFailureRate: rate(db.functionRuns.list(ctx.tenantId), (r) => r.status, ["failed"]),
    actionFailureRate: rate(db.actionExecutions.list(ctx.tenantId), (r) => r.status, ["failed"]),
    notificationFailureRate: rate(db.notifications.list(ctx.tenantId), (r) => r.state, ["failed"]),
    openIncidents: db.runtimeIncidents.list(ctx.tenantId, (i) => i.status === "open").length,
    reviewBacklog: db.reviewCases.list(ctx.tenantId, (c) => c.status === "open").length,
  };
}
