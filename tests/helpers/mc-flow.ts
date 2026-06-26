// Phase 6 test helper — sets up governance and drives the prod release flow.
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import {
  createReleaseBundle,
  submitReleaseForApproval,
} from "@/lib/mission-control/deployments/release-bundle-service";
import { promoteRelease } from "@/lib/mission-control/deployments/release-promotion-service";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";
import { createEvalSuite, createEvalRun } from "@/lib/aiops/evals/eval-run-repository";
import type { ActorContext } from "@/types/platform";
import type {
  ReleaseBundle,
  ReleaseItemType,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";

/** Seed an active eval suite + a passing latest run so a release eval gate passes. */
export async function seedPassingEval(
  ctx: ActorContext,
  componentType: string,
  componentKey: string,
): Promise<void> {
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: `${componentType}-${componentKey}-eval`,
    name: `${componentKey} eval`,
    suiteType: "response",
    targetComponentType: componentType,
    targetComponentKey: componentKey,
    baselineConfig: { averageScore: 0.5 },
  });
  await createEvalRun({
    tenantId: ctx.tenantId,
    suiteType: "response",
    evalSuiteId: suite.id,
    targetComponentType: componentType,
    targetComponentKey: componentKey,
    results: [],
    score: 1,
    passed: true,
    regressionDetected: false,
  });
}

export async function setupGovernance(tenantId = "tnt_test"): Promise<ActorContext> {
  const ctx = systemActor(tenantId);
  await installMissionControlGovernance(ctx);
  // Eval gate (Phase 7): prod releases of eval-gated components require a passing
  // eval. Seed one for the function used across the prod release flow tests.
  await seedPassingEval(ctx, "function", "answer_with_citations");
  return ctx;
}

export interface FlowItem {
  itemType: ReleaseItemType;
  itemKey: string;
  changeType?: "create" | "update" | "delete" | "enable" | "disable";
}

export async function createProdRelease(
  ctx: ActorContext,
  key: string,
  items: FlowItem[],
): Promise<ReleaseBundle> {
  const { release } = await createReleaseBundle(ctx, {
    key,
    name: key,
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items,
  });
  return release;
}

export async function approveProdRelease(ctx: ActorContext, releaseId: string): Promise<void> {
  const pending = await listPendingApprovals(ctx.tenantId);
  const appr = pending.find((a) => a.subjectType === "release_bundle" && a.subjectId === releaseId);
  if (appr) await approveRequest(ctx, appr.id);
}

export async function createAndPromoteProdRelease(
  ctx: ActorContext,
  key: string,
  items: FlowItem[],
): Promise<ReleaseBundle> {
  const release = await createProdRelease(ctx, key, items);
  await submitReleaseForApproval(ctx, release.id);
  await approveProdRelease(ctx, release.id);
  return await promoteRelease(ctx, release.id);
}
