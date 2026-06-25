// Phase 5 (Part N) — a review decision unblocks gated work. Same approval gate as
// the action-button test, but here we assert the decision flow: resolveReviewCase
// + releaseApprovedAction unblocks the execution, a review_case_event is recorded,
// and audit is emitted for the lifecycle.

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

test("approving a review case unblocks the gated action and records events", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  const candidate = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "cand-unblock",
    title: "Unblock Candidate",
    status: "active",
    properties: {},
  });

  const exec = await executeAction(ctx, {
    actionKey: "update_ontology_object",
    input: { objectType: "Candidate", externalKey: candidate.externalKey, objectId: candidate.id, status: "x" },
    object: { type: "Candidate", id: candidate.id },
  });
  assert.equal(exec.status, "awaiting_approval", "action gated on a review case");
  const reviewCaseId = exec.reviewCaseId!;

  // Decision: approve + release unblocks the execution.
  await resolveReviewCase(ctx, reviewCaseId, "approved");
  const released = await releaseApprovedAction(ctx, reviewCaseId);
  assert.equal(released?.status, "completed", "review decision unblocked the action");

  const afterRelease = await db.ontologyObjects.get(ctx.tenantId, candidate.id);
  assert.equal(afterRelease?.status, "x", "governed mutation applied after unblock");

  // A review_case_event records the decision lifecycle (created + approved).
  const events = await db.reviewCaseEvents.list(
    ctx.tenantId,
    (e) => e.reviewCaseId === reviewCaseId,
  );
  assert.ok(events.length >= 1, "review case events recorded");
  assert.ok(events.some((e) => e.kind === "approved"), "an approved event was recorded");

  // Audit emitted across the action + review lifecycle.
  const audit = await db.auditEvents.list(ctx.tenantId);
  assert.ok(
    audit.some((e) => e.action === "review.case.approved"),
    "review approval audited",
  );
  assert.ok(
    audit.some((e) => e.action === "action.completed"),
    "action completion audited",
  );
});
