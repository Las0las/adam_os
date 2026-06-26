// Phase 6 — rollback requires reason + approval + a promoted source release.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { requestRollback, executeRollback } from "@/lib/mission-control/deployments/rollback-service";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";
import { getReleaseBundle } from "@/lib/mission-control/runtime/release-repository";
import { setupGovernance, createAndPromoteProdRelease } from "../helpers/mc-flow";

async function fresh() {
  await resetDatabase();
  resetClock();
  return await setupGovernance();
}

test("rollback requires a reason", async () => {
  const ctx = await fresh();
  const release = await createAndPromoteProdRelease(ctx, "r1", [
    { itemType: "function", itemKey: "fn_a", changeType: "enable" },
  ]);
  await assert.rejects(
    () => requestRollback(ctx, { releaseBundleId: release.id, reason: "" }),
    /requires a reason/,
  );
});

test("rollback requires approval, then executes and marks the release rolled_back", async () => {
  const ctx = await fresh();
  const release = await createAndPromoteProdRelease(ctx, "r2", [
    { itemType: "function", itemKey: "fn_b", changeType: "enable" },
  ]);

  const record = await requestRollback(ctx, { releaseBundleId: release.id, reason: "regression" });
  assert.equal(record.status, "pending_approval");

  // Cannot execute before approval.
  await assert.rejects(() => executeRollback(ctx, { rollbackId: record.id }), /must be approved/);

  // Approve the rollback.
  const pending = await listPendingApprovals(ctx.tenantId);
  const appr = pending.find((a) => a.subjectType === "rollback" && a.subjectId === record.id);
  assert.ok(appr, "expected a pending rollback approval");
  await approveRequest(ctx, appr!.id);

  const completed = await executeRollback(ctx, { rollbackId: record.id });
  assert.equal(completed.status, "completed");

  const original = await getReleaseBundle(ctx.tenantId, release.id);
  assert.equal(original?.status, "rolled_back");
});

test("only a promoted release can be rolled back", async () => {
  const ctx = await fresh();
  // Create a draft release (not promoted) and attempt rollback.
  const { createReleaseBundle } = await import("@/lib/mission-control/deployments/release-bundle-service");
  const { release } = await createReleaseBundle(ctx, {
    key: "draft1",
    name: "draft1",
    releaseType: "function",
    targetEnvironmentKey: "dev",
    items: [{ itemType: "function", itemKey: "x" }],
  });
  await assert.rejects(
    () => requestRollback(ctx, { releaseBundleId: release.id, reason: "x" }),
    /promoted release/,
  );
});
