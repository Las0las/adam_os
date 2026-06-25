// Phase 5 (Part N) — an Object Detail action button routes through Mission
// Control: an approval-required action pauses in awaiting_approval (object
// untouched), and only after the review case is approved + released does the
// governed mutation land.
//
// NOTE: the update_ontology_object builtin upserts by externalKey (its documented
// key). We therefore create the Candidate with an externalKey and pass that key
// (alongside objectId) so the release updates the original object in place — which
// is what "the object changed" means for this governed action.

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

test("approval-gated action pauses, then mutates only after release", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  const candidate = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "cand-gate",
    title: "Gated Candidate",
    status: "active",
    properties: {},
  });

  // 1) Execute WITHOUT approvalExempt -> awaiting_approval, object unchanged.
  const exec = await executeAction(ctx, {
    actionKey: "update_ontology_object",
    input: { objectType: "Candidate", externalKey: candidate.externalKey, objectId: candidate.id, status: "x" },
    object: { type: "Candidate", id: candidate.id },
  });
  assert.equal(exec.status, "awaiting_approval", "action paused for approval");
  assert.ok(exec.reviewCaseId, "a review case gates the action");

  const beforeRelease = await db.ontologyObjects.get(ctx.tenantId, candidate.id);
  assert.equal(beforeRelease?.status, "active", "object NOT changed while awaiting approval");

  // 2) Approve the review case + release -> completed, object now changed.
  await resolveReviewCase(ctx, exec.reviewCaseId!, "approved");
  const released = await releaseApprovedAction(ctx, exec.reviewCaseId!);
  assert.ok(released, "release returned the execution");
  assert.equal(released.status, "completed", "released action completed");

  const afterRelease = await db.ontologyObjects.get(ctx.tenantId, candidate.id);
  assert.equal(afterRelease?.status, "x", "object changed after approval + release");
});
