// Phase 6 — release validation. Computes blockers (hard stops) and warnings for
// a release bundle before submit/promote. Fail-closed: destructive items without
// a governing policy, missing/inactive target environments, and kill-switched
// target components all block. Phase 7 extends this with eval gates.

import { db } from "@/lib/lawrence-core/db";
import { getReleaseBundle, listReleaseBundleItems } from "../runtime/release-repository";
import { getEnvironmentById } from "../runtime/environment-repository";
import { getApprovalPolicyByKey } from "../runtime/approval-repository";
import { getKillSwitch } from "../runtime/kill-switch-repository";
import type { ActorContext } from "@/types/platform";
import type {
  Environment,
  ReleaseBundle,
  ReleaseBundleItem,
  RuntimeComponentType,
} from "../runtime/mission-control-hardening-types";

export interface ReleaseValidationResult {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

const ITEM_TO_COMPONENT: Partial<Record<ReleaseBundleItem["itemType"], RuntimeComponentType>> = {
  pipeline: "pipeline",
  function: "function",
  agent: "agent",
  action: "action",
  notification_rule: "notification_rule",
  model: "model",
};

/** Map item types to the collection used to verify a referenced item id exists. */
async function referencedItemExists(
  tenantId: string,
  item: ReleaseBundleItem,
): Promise<boolean> {
  if (!item.itemId) return true; // nothing to verify
  switch (item.itemType) {
    case "function":
      return Boolean(await db.aiFunctions.get(tenantId, item.itemId));
    case "agent":
      return Boolean(await db.agentDefinitions.get(tenantId, item.itemId));
    case "action":
      return Boolean(await db.actionDefinitions.get(tenantId, item.itemId));
    case "prompt":
      return Boolean(await db.promptTemplates.get(tenantId, item.itemId));
    case "model":
      return Boolean(await db.modelDefinitions.get(tenantId, item.itemId));
    default:
      return true;
  }
}

export async function validateReleaseBundle(
  ctx: ActorContext,
  releaseBundleId: string,
): Promise<ReleaseValidationResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const release = await getReleaseBundle(ctx.tenantId, releaseBundleId);
  if (!release) return { valid: false, blockers: [`release not found: ${releaseBundleId}`], warnings };

  // Target environment must exist and be active.
  const targetEnv = release.targetEnvironmentId
    ? await getEnvironmentById(ctx.tenantId, release.targetEnvironmentId)
    : undefined;
  if (!targetEnv) {
    blockers.push("target environment does not exist");
  } else if (targetEnv.status !== "active") {
    blockers.push(`target environment '${targetEnv.key}' is ${targetEnv.status}`);
  }

  const items = await listReleaseBundleItems(ctx.tenantId, releaseBundleId);
  if (items.length === 0) blockers.push("release bundle has no items");

  const destructivePolicy = await getApprovalPolicyByKey(
    ctx.tenantId,
    "destructive_action_requires_approval",
  );

  for (const item of items) {
    if (!(await referencedItemExists(ctx.tenantId, item))) {
      blockers.push(`referenced ${item.itemType} '${item.itemKey ?? item.itemId}' does not exist`);
    }

    // Destructive change without a governing policy is a hard stop.
    if (item.changeType === "delete" && !destructivePolicy) {
      blockers.push(
        `destructive change to ${item.itemType} '${item.itemKey ?? item.itemId}' has no approval policy`,
      );
    }

    // A kill-switched target component blocks promotion unless this item disables it.
    const componentType = ITEM_TO_COMPONENT[item.itemType];
    if (componentType && item.itemKey && item.changeType !== "disable") {
      const ks = await getKillSwitch(
        ctx.tenantId,
        componentType,
        item.itemKey,
        release.targetEnvironmentId ?? null,
      );
      if (ks?.enabled) {
        blockers.push(
          `component ${componentType}:${item.itemKey} is kill-switched; cannot promote a non-disabling change`,
        );
      }
    }
  }

  // Production target requires approval before promotion (enforced at promote;
  // surfaced here as a warning so operators see it pre-submit).
  if (targetEnv?.environmentType === "prod" && release.status !== "approved") {
    warnings.push("production target requires approval before promotion");
  }

  return { valid: blockers.length === 0, blockers, warnings };
}

export type { Environment, ReleaseBundle };
