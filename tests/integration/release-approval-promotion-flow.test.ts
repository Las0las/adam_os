// Phase 6 — full prod release flow: create -> submit -> approve -> promote, and
// promotion registers a runtime component.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import {
  createReleaseBundle,
  submitReleaseForApproval,
} from "@/lib/mission-control/deployments/release-bundle-service";
import { promoteRelease } from "@/lib/mission-control/deployments/release-promotion-service";
import { listPendingApprovals } from "@/lib/mission-control/runtime/approval-repository";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";
import { getRuntimeComponent } from "@/lib/mission-control/runtime/runtime-component-repository";
import { getReleaseBundle } from "@/lib/mission-control/runtime/release-repository";
import { getEnvironmentByKey } from "@/lib/mission-control/runtime/environment-repository";
import { setupGovernance } from "../helpers/mc-flow";

test("approved prod release promotes and creates a runtime component", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();

  const { release } = await createReleaseBundle(ctx, {
    key: "rel-fn",
    name: "Ship answer fn",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "answer_with_citations", changeType: "enable" }],
  });

  const submit = await submitReleaseForApproval(ctx, release.id);
  assert.equal(submit.submitted, true);
  assert.equal(submit.approvalRequired, true);
  assert.equal(submit.release.status, "pending_approval");

  const pending = await listPendingApprovals(ctx.tenantId);
  const appr = pending.find((a) => a.subjectType === "release_bundle" && a.subjectId === release.id);
  assert.ok(appr, "expected a pending release approval");
  await approveRequest(ctx, appr!.id);

  assert.equal((await getReleaseBundle(ctx.tenantId, release.id))?.status, "approved");

  const promoted = await promoteRelease(ctx, release.id);
  assert.equal(promoted.status, "promoted");

  const env = await getEnvironmentByKey(ctx.tenantId, "prod");
  const comp = await getRuntimeComponent(ctx.tenantId, "function", "answer_with_citations", env!.id);
  assert.ok(comp, "expected a runtime component after promotion");
  assert.equal(comp?.status, "enabled");
});
