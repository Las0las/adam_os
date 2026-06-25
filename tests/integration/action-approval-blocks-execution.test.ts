// Proves the approval gate: a customer-affecting action (update_ontology_object)
// pauses in awaiting_approval and does NOT mutate the target until a reviewer
// approves and the gated execution is released.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import {
  executeAction,
  releaseApprovedAction,
} from "@/lib/mission-control/actions/action-service";
import { resolveReviewCase } from "@/lib/mission-control/review-queue/review-service";
import "@/lib/mission-control/actions/builtins";

test("approval-gated update_ontology_object blocks execution until released", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  const obj = await upsertObject(ctx, {
    objectType: "Account",
    externalKey: "acct-1",
    status: "active",
  });

  // Execute without an exemption -> should pause for approval.
  const exec = await executeAction(ctx, {
    actionKey: "update_ontology_object",
    input: { objectType: "Account", externalKey: "acct-1", status: "suspended" },
    object: { type: "Account", id: obj.id },
  });
  assert.equal(exec.status, "awaiting_approval");
  assert.ok(exec.reviewCaseId);

  // Target is unchanged while the action awaits approval.
  const stillActive = await db.ontologyObjects.get(ctx.tenantId, obj.id);
  assert.equal(stillActive?.status, "active");

  // Approve + release -> the action runs and the object is mutated.
  await resolveReviewCase(ctx, exec.reviewCaseId!, "approved");
  const released = await releaseApprovedAction(ctx, exec.reviewCaseId!);
  assert.equal(released?.status, "completed");

  const updated = await db.ontologyObjects.get(ctx.tenantId, obj.id);
  assert.equal(updated?.status, "suspended");
});
