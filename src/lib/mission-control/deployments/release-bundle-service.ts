// Phase 6 — release bundle service. Create draft bundles with items, and submit
// them for approval. Submission validates first (fail-closed on blockers) and
// only production targets require human approval; non-prod releases that pass
// validation are marked approved so they can be promoted.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { id } from "@/lib/lawrence-core/utils/ids";
import { getEnvironmentById, getEnvironmentByKey } from "../runtime/environment-repository";
import {
  addReleaseBundleItem,
  createReleaseBundle as createReleaseBundleRow,
  getReleaseBundle,
  listReleaseBundleItems,
  markReleaseApproved,
  updateReleaseStatus,
} from "../runtime/release-repository";
import { createApprovalForSubject } from "../approvals/approval-request-service";
import { validateReleaseBundle } from "./release-validation-service";
import type { ActorContext } from "@/types/platform";
import type {
  ReleaseBundle,
  ReleaseBundleItem,
  ReleaseItemChangeType,
  ReleaseItemType,
  ReleaseType,
} from "../runtime/mission-control-hardening-types";

export interface CreateReleaseInput {
  key: string;
  name: string;
  description?: string;
  releaseType: ReleaseType;
  sourceEnvironmentKey?: string;
  targetEnvironmentKey: string;
  items: Array<{
    itemType: ReleaseItemType;
    itemId?: string | null;
    itemKey?: string | null;
    itemVersion?: number | null;
    changeType?: ReleaseItemChangeType;
    payload?: Record<string, unknown>;
  }>;
  actorUserId?: string | null;
}

export async function createReleaseBundle(
  ctx: ActorContext,
  input: CreateReleaseInput,
): Promise<{ release: ReleaseBundle; items: ReleaseBundleItem[] }> {
  requirePermission(ctx, "mission_control.admin");

  const targetEnv = await getEnvironmentByKey(ctx.tenantId, input.targetEnvironmentKey);
  if (!targetEnv) throw new Error(`Target environment not found: ${input.targetEnvironmentKey}`);
  if (targetEnv.status !== "active") {
    throw new Error(`Target environment '${targetEnv.key}' is ${targetEnv.status}`);
  }
  const sourceEnv = input.sourceEnvironmentKey
    ? await getEnvironmentByKey(ctx.tenantId, input.sourceEnvironmentKey)
    : undefined;

  const release = await createReleaseBundleRow({
    tenantId: ctx.tenantId,
    key: input.key || id("relkey"),
    name: input.name,
    description: input.description ?? null,
    releaseType: input.releaseType,
    sourceEnvironmentId: sourceEnv?.id ?? null,
    targetEnvironmentId: targetEnv.id,
    createdBy: input.actorUserId ?? ctx.actorUserId ?? null,
  });

  const items: ReleaseBundleItem[] = [];
  for (const item of input.items) {
    items.push(
      await addReleaseBundleItem({
        tenantId: ctx.tenantId,
        releaseBundleId: release.id,
        itemType: item.itemType,
        itemId: item.itemId ?? null,
        itemKey: item.itemKey ?? null,
        itemVersion: item.itemVersion ?? null,
        changeType: item.changeType ?? "update",
        payload: item.payload ?? {},
      }),
    );
  }

  await emitAudit(ctx, "mission.release.created", { type: "release_bundle", id: release.id }, {
    key: release.key,
    targetEnvironment: targetEnv.key,
    itemCount: items.length,
  });

  return { release, items };
}

export interface SubmitResult {
  submitted: boolean;
  approvalRequired: boolean;
  release: ReleaseBundle;
  validation: { valid: boolean; blockers: string[]; warnings: string[] };
}

export async function submitReleaseForApproval(
  ctx: ActorContext,
  releaseBundleId: string,
): Promise<SubmitResult> {
  requirePermission(ctx, "mission_control.admin");
  const release = await getReleaseBundle(ctx.tenantId, releaseBundleId);
  if (!release) throw new Error(`Release bundle not found: ${releaseBundleId}`);

  const validation = await validateReleaseBundle(ctx, releaseBundleId);
  if (!validation.valid) {
    const updated = await updateReleaseStatus({
      tenantId: ctx.tenantId,
      releaseBundleId,
      status: "draft",
      validation,
    });
    return { submitted: false, approvalRequired: false, release: updated, validation };
  }

  const targetEnv = release.targetEnvironmentId
    ? await getEnvironmentById(ctx.tenantId, release.targetEnvironmentId)
    : undefined;
  const isProd = targetEnv?.environmentType === "prod";

  if (isProd) {
    // Production: fail-closed approval via policy.
    const decision = await createApprovalForSubject(ctx, {
      subjectType: "release_bundle",
      subjectId: release.id,
      policyKey: "prod_release_requires_approval",
      subjectPayload: { target: { environmentType: "prod" }, releaseType: release.releaseType },
      reason: `Promote release '${release.name}' to production`,
    });
    const updated = await updateReleaseStatus({
      tenantId: ctx.tenantId,
      releaseBundleId,
      status: "pending_approval",
      validation,
    });
    await emitAudit(
      ctx,
      "mission.release.submitted_for_approval",
      { type: "release_bundle", id: release.id },
      { approvalRequestId: decision.request?.id ?? null },
    );
    return { submitted: true, approvalRequired: true, release: updated, validation };
  }

  // Non-prod: passing validation auto-approves so it can be promoted.
  const approved = await markReleaseApproved({
    tenantId: ctx.tenantId,
    releaseBundleId,
    approvedBy: ctx.actorUserId ?? null,
  });
  await updateReleaseStatus({ tenantId: ctx.tenantId, releaseBundleId, status: "approved", validation });
  await emitAudit(
    ctx,
    "mission.release.submitted_for_approval",
    { type: "release_bundle", id: release.id },
    { autoApproved: true },
  );
  return { submitted: true, approvalRequired: false, release: approved, validation };
}

export async function getReleaseBundleDetail(
  ctx: ActorContext,
  releaseBundleId: string,
): Promise<{ release: ReleaseBundle; items: ReleaseBundleItem[] } | null> {
  const release = await getReleaseBundle(ctx.tenantId, releaseBundleId);
  if (!release) return null;
  const items = await listReleaseBundleItems(ctx.tenantId, releaseBundleId);
  return { release, items };
}
