// Phase 6 — rollback requires reason + approval before it can execute.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { requestRollback, executeRollback } from "@/lib/mission-control/deployments/rollback-service";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";
import { setupGovernance, createAndPromoteProdRelease } from "../helpers/mc-flow";

test("rollback: empty reason blocked; requires approval; then executes", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();
  const release = await createAndPromoteProdRelease(ctx, "rel-x", [
    { itemType: "function", itemKey: "answer_with_citations", changeType: "enable" },
  ]);

  await assert.rejects(
    () => requestRollback(ctx, { releaseBundleId: release.id, reason: "  " }),
    /requires a reason/,
  );

  const record = await requestRollback(ctx, { releaseBundleId: release.id, reason: "bad deploy" });
  assert.equal(record.status, "pending_approval");
  await assert.rejects(() => executeRollback(ctx, { rollbackId: record.id }), /must be approved/);

  const appr = (await listPendingApprovals(ctx.tenantId)).find(
    (a) => a.subjectType === "rollback" && a.subjectId === record.id,
  );
  await approveRequest(ctx, appr!.id);
  const done = await executeRollback(ctx, { rollbackId: record.id });
  assert.equal(done.status, "completed");
});
