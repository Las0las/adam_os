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
import {
  createNotificationRule,
  emitEvent,
  allowDestination,
} from "@/lib/mission-control/notifications/notification-service";
import { promoteRelease, createRelease } from "@/lib/mission-control/runtime/deployment-service";
import "@/lib/domains/recruiting/recruiting-pack";

function ctxFresh() {
  resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("approval-gated action blocks then runs after approval", async () => {
  const ctx = ctxFresh();
  const candidate = upsertObject(ctx, { objectType: "Candidate", externalKey: "ada", title: "Ada", status: "new" });

  const exec = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "interview" },
    object: { type: "Candidate", id: candidate.id },
  });
  assert.equal(exec.status, "blocked");
  assert.ok(exec.reviewCaseId);

  resolveReviewCase(ctx, exec.reviewCaseId!, "approved");
  const released = await releaseApprovedAction(ctx, exec.reviewCaseId!);
  assert.equal(released?.status, "completed");
  assert.equal(db.ontologyObjects.get(ctx.tenantId, candidate.id)!.status, "interview");
});

test("precondition blocks invalid stage", async () => {
  const ctx = ctxFresh();
  const candidate = upsertObject(ctx, { objectType: "Candidate", externalKey: "x", title: "X" });
  const exec = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "nonsense" },
    approvalExempt: true,
  });
  assert.equal(exec.status, "blocked");
  assert.match(exec.blockedReason ?? "", /invalid stage/);
});

test("idempotency returns the same execution", async () => {
  const ctx = ctxFresh();
  const candidate = upsertObject(ctx, { objectType: "Candidate", externalKey: "y", title: "Y" });
  const a = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "screen" },
    idempotencyKey: "k1",
    approvalExempt: true,
  });
  const b = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "screen" },
    idempotencyKey: "k1",
    approvalExempt: true,
  });
  assert.equal(a.id, b.id);
});

test("notification: external channel blocked unless allowlisted", () => {
  const ctx = ctxFresh();
  createNotificationRule(ctx, {
    name: "slack ping",
    eventKey: "test.event",
    channel: "slack",
    destination: "https://hooks.slack.com/x",
    template: "hi {{name}}",
  });
  let notes = emitEvent(ctx, "test.event", "usr_1", { name: "Ada" });
  assert.equal(notes[0]!.state, "failed");

  allowDestination("https://hooks.slack.com/x");
  notes = emitEvent(ctx, "test.event", "usr_2", { name: "Ada" });
  assert.equal(notes[0]!.state, "sent");
});

test("release promotes draft -> staging -> production", () => {
  const ctx = ctxFresh();
  const rel = createRelease(ctx, { name: "r1", artifacts: [] });
  assert.equal(rel.environment, "draft");
  assert.equal(promoteRelease(ctx, rel.id).environment, "staging");
  assert.equal(promoteRelease(ctx, rel.id).environment, "production");
  assert.throws(() => promoteRelease(ctx, rel.id));
});
