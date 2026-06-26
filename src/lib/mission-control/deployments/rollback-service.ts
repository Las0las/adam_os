// Phase 6 — rollback service. Requesting a rollback requires a reason and a
// promoted source release; it creates a reverse release bundle + rollback record
// and an approval request (fail-closed). Executing requires approval, reverses
// each original item against runtime components, and marks both records. Any
// failure marks the rollback failed and raises a critical incident.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { getReleaseBundle, listReleaseBundleItems, markReleaseRolledBack, createReleaseBundle } from "../runtime/release-repository";
import {
  createRollbackRecord,
  getRollbackRecord,
  updateRollbackStatus,
} from "../runtime/rollback-repository";
import {
  getRuntimeComponent,
  setRuntimeComponentStatus,
  upsertRuntimeComponent,
} from "../runtime/runtime-component-repository";
import { recordHealthCheck } from "../runtime/health-check-repository";
import { raiseIncident } from "../runtime/deployment-service";
import { createApprovalForSubject } from "../approvals/approval-request-service";
import type { ActorContext } from "@/types/platform";
import type {
  ReleaseBundleItem,
  RollbackRecord,
  RuntimeComponentType,
} from "../runtime/mission-control-hardening-types";

const ITEM_TO_COMPONENT: Partial<Record<ReleaseBundleItem["itemType"], RuntimeComponentType>> = {
  pipeline: "pipeline",
  function: "function",
  agent: "agent",
  action: "action",
  notification_rule: "notification_rule",
  model: "model",
};

export async function requestRollback(
  ctx: ActorContext,
  input: { releaseBundleId: string; reason: string; emergency?: boolean },
): Promise<RollbackRecord> {
  requirePermission(ctx, "mission_control.admin");
  if (!input.reason || !input.reason.trim()) {
    throw new Error("Rollback requires a reason.");
  }

  const release = await getReleaseBundle(ctx.tenantId, input.releaseBundleId);
  if (!release) throw new Error(`Release bundle not found: ${input.releaseBundleId}`);
  if (release.status !== "promoted") {
    throw new Error(`Only a promoted release can be rolled back (status: ${release.status}).`);
  }

  // Reverse release bundle (audit trail of the rollback as a release).
  const reverseBundle = await createReleaseBundle({
    tenantId: ctx.tenantId,
    key: `rollback-${release.key}`,
    name: `Rollback of ${release.name}`,
    description: input.reason,
    releaseType: "mixed",
    sourceEnvironmentId: release.targetEnvironmentId ?? null,
    targetEnvironmentId: release.targetEnvironmentId ?? null,
    createdBy: ctx.actorUserId ?? null,
    rollbackOfReleaseId: release.id,
  });

  const record = await createRollbackRecord({
    tenantId: ctx.tenantId,
    releaseBundleId: release.id,
    rollbackReleaseBundleId: reverseBundle.id,
    reason: input.reason,
    requestedBy: ctx.actorUserId ?? null,
  });

  const decision = await createApprovalForSubject(ctx, {
    subjectType: "rollback",
    subjectId: record.id,
    policyKey: "rollback_requires_approval",
    subjectPayload: { emergency: input.emergency === true },
    reason: input.reason,
  });

  const status = decision.approvalRequired ? "pending_approval" : "approved";
  const updated = await updateRollbackStatus({
    tenantId: ctx.tenantId,
    rollbackId: record.id,
    status,
  });

  await emitAudit(ctx, "mission.rollback.requested", { type: "rollback", id: record.id }, {
    releaseBundleId: release.id,
    approvalRequired: decision.approvalRequired,
  });

  return updated;
}

export async function executeRollback(
  ctx: ActorContext,
  input: { rollbackId: string },
): Promise<RollbackRecord> {
  requirePermission(ctx, "deploy.promote");

  const record = await getRollbackRecord(ctx.tenantId, input.rollbackId);
  if (!record) throw new Error(`Rollback record not found: ${input.rollbackId}`);
  if (record.status !== "approved") {
    throw new Error(`Rollback must be approved before execution (status: ${record.status}).`);
  }

  const release = await getReleaseBundle(ctx.tenantId, record.releaseBundleId);
  if (!release) throw new Error(`Original release not found: ${record.releaseBundleId}`);
  const items = await listReleaseBundleItems(ctx.tenantId, record.releaseBundleId);

  try {
    for (const item of items) {
      await reverseItem(ctx, release.targetEnvironmentId ?? null, item);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateRollbackStatus({ tenantId: ctx.tenantId, rollbackId: record.id, status: "failed" });
    await emitAudit(ctx, "mission.rollback.failed", { type: "rollback", id: record.id }, {
      error: message,
    });
    await raiseIncident(ctx, {
      title: `Rollback failed: ${release.name}`,
      severity: "critical",
      source: "rollback",
      detail: message,
    });
    throw new Error(`rollback failed: ${message}`);
  }

  const completed = await updateRollbackStatus({
    tenantId: ctx.tenantId,
    rollbackId: record.id,
    status: "completed",
    completedBy: ctx.actorUserId ?? null,
  });
  await markReleaseRolledBack({ tenantId: ctx.tenantId, releaseBundleId: release.id });

  for (const item of items) {
    const componentType = ITEM_TO_COMPONENT[item.itemType];
    if (componentType && item.itemKey) {
      await recordHealthCheck({
        tenantId: ctx.tenantId,
        componentType,
        componentKey: item.itemKey,
        environmentId: release.targetEnvironmentId ?? null,
        status: "unknown",
        message: `rolled back via ${record.id}`,
      });
    }
  }

  await emitAudit(ctx, "mission.rollback.completed", { type: "rollback", id: record.id }, {
    releaseBundleId: release.id,
  });

  return completed;
}

async function reverseItem(
  ctx: ActorContext,
  environmentId: string | null,
  item: ReleaseBundleItem,
): Promise<void> {
  const componentType = ITEM_TO_COMPONENT[item.itemType];
  if (!componentType || !item.itemKey) return;

  // Restore the prior snapshot when we have one (update reversal).
  if (item.previousSnapshot && typeof item.previousSnapshot === "object") {
    const snap = item.previousSnapshot as {
      status?: string;
      version?: number | null;
      config?: Record<string, unknown>;
    };
    await upsertRuntimeComponent({
      tenantId: ctx.tenantId,
      componentType,
      componentKey: item.itemKey,
      environmentId,
      status: (snap.status as never) ?? "enabled",
      version: snap.version ?? null,
      config: snap.config ?? {},
    });
    return;
  }

  // No prior snapshot: reverse by change type.
  let nextStatus: "enabled" | "disabled";
  switch (item.changeType) {
    case "create":
    case "enable":
      nextStatus = "disabled"; // undo an addition/enable by disabling
      break;
    case "disable":
      nextStatus = "enabled"; // undo a disable by re-enabling
      break;
    default:
      nextStatus = "disabled";
  }
  await setRuntimeComponentStatus({
    tenantId: ctx.tenantId,
    componentType,
    componentKey: item.itemKey,
    environmentId,
    status: nextStatus,
  });
}
