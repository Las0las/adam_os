// Phase 6 — release promotion. Fail-closed: a production target may only promote
// an approved bundle, and a re-validation with blockers aborts. Applying items
// upserts runtime components (capturing the prior snapshot for rollback). Any
// item failure marks the release failed and raises a high-severity incident — no
// fake success.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { db } from "@/lib/lawrence-core/db";
import { getEnvironmentById } from "../runtime/environment-repository";
import {
  getReleaseBundle,
  listReleaseBundleItems,
  markReleaseFailed,
  markReleasePromoted,
} from "../runtime/release-repository";
import {
  getRuntimeComponent,
  upsertRuntimeComponent,
} from "../runtime/runtime-component-repository";
import { recordHealthCheck } from "../runtime/health-check-repository";
import { raiseIncident } from "../runtime/deployment-service";
import type { ActorContext } from "@/types/platform";
import type {
  ReleaseBundle,
  ReleaseBundleItem,
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

export async function promoteRelease(
  ctx: ActorContext,
  releaseBundleId: string,
): Promise<ReleaseBundle> {
  requirePermission(ctx, "deploy.promote");

  const release = await getReleaseBundle(ctx.tenantId, releaseBundleId);
  if (!release) throw new Error(`Release bundle not found: ${releaseBundleId}`);

  const targetEnv = release.targetEnvironmentId
    ? await getEnvironmentById(ctx.tenantId, release.targetEnvironmentId)
    : undefined;
  if (!targetEnv) throw new Error("target environment does not exist");
  if (targetEnv.status !== "active") {
    throw new Error(`target environment '${targetEnv.key}' is ${targetEnv.status}`);
  }

  // Fail-closed production gate.
  if (targetEnv.environmentType === "prod" && release.status !== "approved") {
    throw new Error(
      `production release requires approval before promotion (status: ${release.status})`,
    );
  }
  if (release.status === "promoted") {
    throw new Error("release already promoted");
  }
  if (release.status === "failed" || release.status === "rolled_back") {
    throw new Error(`cannot promote a ${release.status} release`);
  }

  const items = await listReleaseBundleItems(ctx.tenantId, releaseBundleId);
  if (items.length === 0) throw new Error("release bundle has no items");

  try {
    for (const item of items) {
      await applyItem(ctx, release, item);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markReleaseFailed({ tenantId: ctx.tenantId, releaseBundleId });
    await emitAudit(ctx, "mission.release.failed", { type: "release_bundle", id: release.id }, {
      error: message,
    });
    await raiseIncident(ctx, {
      title: `Release promotion failed: ${release.name}`,
      severity: "high",
      source: "release_promotion",
      detail: message,
    });
    throw new Error(`release promotion failed: ${message}`);
  }

  const promoted = await markReleasePromoted({
    tenantId: ctx.tenantId,
    releaseBundleId,
    promotedBy: ctx.actorUserId ?? null,
  });

  // Health placeholder for each affected component.
  for (const item of items) {
    const componentType = ITEM_TO_COMPONENT[item.itemType];
    if (componentType && item.itemKey) {
      await recordHealthCheck({
        tenantId: ctx.tenantId,
        componentType,
        componentKey: item.itemKey,
        environmentId: release.targetEnvironmentId ?? null,
        status: "unknown",
        message: `promoted via release ${release.key}`,
      });
    }
  }

  await emitAudit(ctx, "mission.release.promoted", { type: "release_bundle", id: release.id }, {
    targetEnvironment: targetEnv.key,
    itemCount: items.length,
  });

  return promoted;
}

async function applyItem(
  ctx: ActorContext,
  release: ReleaseBundle,
  item: ReleaseBundleItem,
): Promise<void> {
  const componentType = ITEM_TO_COMPONENT[item.itemType];
  if (!componentType || !item.itemKey) return; // config/domain_pack/prompt: payload-only

  // Capture prior snapshot for rollback.
  const previous = await getRuntimeComponent(
    ctx.tenantId,
    componentType,
    item.itemKey,
    release.targetEnvironmentId ?? null,
  );
  if (previous) {
    await db.releaseBundleItems.update(item.id, {
      previousSnapshot: {
        status: previous.status,
        version: previous.version ?? null,
        config: previous.config,
      },
    });
  }

  const disabled = item.changeType === "disable" || item.payload.disabled === true;
  await upsertRuntimeComponent({
    tenantId: ctx.tenantId,
    componentType,
    componentKey: item.itemKey,
    componentId: item.itemId ?? null,
    environmentId: release.targetEnvironmentId ?? null,
    status: disabled ? "disabled" : "enabled",
    version: item.itemVersion ?? null,
    config: item.payload,
  });
}
