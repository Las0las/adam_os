// Phase 6 — a policy-gated action pauses for approval, then continues to run
// once the approval is granted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { registerAction, executeAction } from "@/lib/mission-control/actions/action-service";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";
import { setupGovernance } from "../helpers/mc-flow";

let ran = 0;
registerAction({
  key: "danger_send",
  approvalPolicyKey: "destructive_action_requires_approval",
  dangerous: true,
  async run() {
    ran += 1;
    return { sent: true };
  },
});

test("policy-gated action awaits approval then continues", async () => {
  await resetDatabase();
  resetClock();
  ran = 0;
  const ctx = await setupGovernance();

  const exec = await executeAction(ctx, { actionKey: "danger_send", input: { to: "x" } });
  assert.equal(exec.status, "awaiting_approval");
  assert.equal(ran, 0, "must not run before approval");

  const appr = (await listPendingApprovals(ctx.tenantId)).find(
    (a) => a.subjectType === "action_execution" && a.subjectId === exec.id,
  );
  assert.ok(appr, "expected an action approval request");

  await approveRequest(ctx, appr!.id);

  const after = await db.actionExecutions.get(ctx.tenantId, exec.id);
  assert.equal(after?.status, "completed");
  assert.equal(ran, 1, "action runs exactly once after approval");
});
