// Phase 10 — retention & deletion. Policies declare how long objects of a type
// live and what happens at expiry (archive | redact | delete | review). The job
// runner is fail-closed and ALWAYS audits every affected object — customer data
// is never deleted without a retention/deletion audit trail (§ security rules).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { redactObject } from "./redaction-service";
import type { ActorContext } from "@/types/platform";
import type { RetentionAction, RetentionJob, RetentionPolicy } from "./compliance-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createRetentionPolicy(
  ctx: ActorContext,
  input: {
    key: string;
    name: string;
    objectType: string;
    retentionDays: number;
    action: RetentionAction;
    config?: Record<string, unknown>;
  },
): Promise<RetentionPolicy> {
  requirePermission(ctx, "security.retention_manage");
  const policy = await db.retentionPolicies.insert({
    id: id("retpol"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    objectType: input.objectType,
    retentionDays: input.retentionDays,
    action: input.action,
    status: "active",
    config: input.config ?? {},
    createdAt: now(),
  });
  await emitAudit(ctx, "security.retention.policy_created", { type: "retention_policy", id: policy.id }, {
    objectType: policy.objectType,
    retentionDays: policy.retentionDays,
    action: policy.action,
  });
  return policy;
}

export async function listRetentionPolicies(tenantId: string): Promise<RetentionPolicy[]> {
  return await db.retentionPolicies.list(tenantId);
}

export async function listRetentionJobs(tenantId: string): Promise<RetentionJob[]> {
  return (await db.retentionJobs.list(tenantId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Run a retention policy. Fail-closed: an unknown/inactive policy yields a
 * blocked job, not a silent no-op. `asOf` lets callers/tests pin the reference
 * instant; defaults to now(). Every affected object emits a per-object audit and
 * the deletion/redaction is recorded so customer data never leaves silently.
 */
export async function runRetentionJob(
  ctx: ActorContext,
  policyId: string,
  opts: { asOf?: string; dryRun?: boolean } = {},
): Promise<RetentionJob> {
  requirePermission(ctx, "security.retention_manage");

  const policy = await db.retentionPolicies.get(ctx.tenantId, policyId);
  if (!policy || policy.status !== "active") {
    const blocked = await db.retentionJobs.insert({
      id: id("retjob"),
      tenantId: ctx.tenantId,
      retentionPolicyId: policyId,
      status: "blocked",
      affectedCount: 0,
      result: { reason: policy ? "policy inactive" : "policy not found" },
      createdBy: ctx.actorUserId ?? null,
      createdAt: now(),
      completedAt: now(),
    });
    await emitAudit(ctx, "security.retention.job_blocked", { type: "retention_job", id: blocked.id }, {
      policyId,
      reason: blocked.result.reason,
    });
    return blocked;
  }

  const job = await db.retentionJobs.insert({
    id: id("retjob"),
    tenantId: ctx.tenantId,
    retentionPolicyId: policyId,
    status: "running",
    affectedCount: 0,
    result: {},
    createdBy: ctx.actorUserId ?? null,
    createdAt: now(),
    completedAt: null,
  });

  const reference = opts.asOf ? Date.parse(opts.asOf) : Date.parse(now());
  const cutoff = reference - policy.retentionDays * DAY_MS;

  const expired = await db.ontologyObjects.list(
    ctx.tenantId,
    (o) => o.objectType === policy.objectType && Date.parse(o.createdAt) <= cutoff,
  );

  const affected: Array<{ objectId: string; action: RetentionAction }> = [];
  for (const obj of expired) {
    if (!opts.dryRun) {
      await applyRetentionAction(ctx, policy.action, obj.id, obj.objectType);
    }
    affected.push({ objectId: obj.id, action: policy.action });
    await emitAudit(ctx, `security.retention.${policy.action}`, { type: policy.objectType, id: obj.id }, {
      policyId,
      retentionDays: policy.retentionDays,
      dryRun: Boolean(opts.dryRun),
    });
  }

  const finished = await db.retentionJobs.update(job.id, {
    status: "completed",
    affectedCount: affected.length,
    result: { action: policy.action, objectType: policy.objectType, cutoff: new Date(cutoff).toISOString(), affected },
    completedAt: now(),
  });
  await emitAudit(ctx, "security.retention.job_completed", { type: "retention_job", id: job.id }, {
    policyId,
    action: policy.action,
    affectedCount: affected.length,
    dryRun: Boolean(opts.dryRun),
  });
  return finished;
}

async function applyRetentionAction(
  ctx: ActorContext,
  action: RetentionAction,
  objectId: string,
  objectType: string,
): Promise<void> {
  switch (action) {
    case "delete":
      await db.ontologyObjects.delete(ctx.tenantId, objectId);
      return;
    case "archive":
      await db.ontologyObjects.update(objectId, { status: "archived", updatedAt: now() });
      return;
    case "redact": {
      const obj = await db.ontologyObjects.get(ctx.tenantId, objectId);
      if (obj) {
        const redacted = redactObject(obj.properties as Record<string, unknown>, [
          { fieldPath: "*", strategy: "token", classification: "confidential" },
        ]);
        await db.ontologyObjects.update(objectId, { properties: redacted, updatedAt: now() });
      }
      return;
    }
    case "review":
      // Flag for human review rather than mutating; the audit above is the record.
      await db.ontologyObjects.update(objectId, {
        properties: { ...(await retentionFlag(ctx, objectId)), __retentionReview: true },
        updatedAt: now(),
      });
      return;
    default:
      return;
  }
}

async function retentionFlag(ctx: ActorContext, objectId: string): Promise<Record<string, unknown>> {
  const obj = await db.ontologyObjects.get(ctx.tenantId, objectId);
  return (obj?.properties as Record<string, unknown>) ?? {};
}
