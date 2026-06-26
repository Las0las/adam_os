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
import {
  setChannelAdapter,
  resetChannelAdapters,
} from "@/lib/mission-control/notifications/channels/channel-registry";
import type { ChannelMessage } from "@/lib/mission-control/notifications/channels/channel-types";
import { promoteRelease, createRelease } from "@/lib/mission-control/runtime/deployment-service";
import "@/lib/domains/recruiting/recruiting-pack";

async function ctxFresh() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("approval-gated action blocks then runs after approval", async () => {
  const ctx = await ctxFresh();
  const candidate = await upsertObject(ctx, { objectType: "Candidate", externalKey: "ada", title: "Ada", status: "new" });

  const exec = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "interview" },
    object: { type: "Candidate", id: candidate.id },
  });
  assert.equal(exec.status, "awaiting_approval");
  assert.ok(exec.reviewCaseId);

  await resolveReviewCase(ctx, exec.reviewCaseId!, "approved");
  const released = await releaseApprovedAction(ctx, exec.reviewCaseId!);
  assert.equal(released?.status, "completed");
  assert.equal((await db.ontologyObjects.get(ctx.tenantId, candidate.id))!.status, "interview");
});

test("precondition blocks invalid stage", async () => {
  const ctx = await ctxFresh();
  const candidate = await upsertObject(ctx, { objectType: "Candidate", externalKey: "x", title: "X" });
  const exec = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: candidate.id, toStage: "nonsense" },
    approvalExempt: true,
  });
  assert.equal(exec.status, "blocked");
  assert.match(exec.blockedReason ?? "", /invalid stage/);
});

test("idempotency returns the same execution", async () => {
  const ctx = await ctxFresh();
  const candidate = await upsertObject(ctx, { objectType: "Candidate", externalKey: "y", title: "Y" });
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

test("notification: external channel queues internally unless allowlisted AND configured", async () => {
  const ctx = await ctxFresh();
  const hook = "https://hooks.slack.com/x";
  await createNotificationRule(ctx, {
    name: "slack ping",
    eventKey: "test.event",
    channel: "slack",
    destination: hook,
    template: "hi {{name}}",
  });

  // Not allowlisted, no transport: internal queue only — never sent externally.
  let notes = await emitEvent(ctx, "test.event", "usr_1", { name: "Ada" });
  assert.equal(notes[0]!.state, "queued");

  // Allowlisted but still no configured adapter: still internal queue only.
  allowDestination(hook);
  notes = await emitEvent(ctx, "test.event", "usr_2", { name: "Ada" });
  assert.equal(notes[0]!.state, "queued");

  // Allowlisted AND a configured transport installed: real send path → sent.
  const sent: ChannelMessage[] = [];
  setChannelAdapter("slack", {
    channel: "slack",
    isConfigured: () => true,
    async send(message) {
      sent.push(message);
      return { ok: true };
    },
  });
  try {
    notes = await emitEvent(ctx, "test.event", "usr_3", { name: "Ada" });
    assert.equal(notes[0]!.state, "sent");
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.destination, hook);
  } finally {
    resetChannelAdapters();
  }
});

test("notification: configured transport that errors is recorded as failed", async () => {
  const ctx = await ctxFresh();
  const hook = "https://hooks.slack.com/y";
  await createNotificationRule(ctx, {
    name: "slack ping",
    eventKey: "test.fail",
    channel: "slack",
    destination: hook,
    template: "hi",
  });
  allowDestination(hook);
  setChannelAdapter("slack", {
    channel: "slack",
    isConfigured: () => true,
    async send() {
      return { ok: false, error: "boom" };
    },
  });
  try {
    const notes = await emitEvent(ctx, "test.fail", "usr_1", {});
    assert.equal(notes[0]!.state, "failed");
    assert.match(notes[0]!.error ?? "", /boom/);
  } finally {
    resetChannelAdapters();
  }
});

test("release promotes draft -> staging -> production", async () => {
  const ctx = await ctxFresh();
  const rel = await createRelease(ctx, { name: "r1", artifacts: [] });
  assert.equal(rel.environment, "draft");
  assert.equal((await promoteRelease(ctx, rel.id)).environment, "staging");
  assert.equal((await promoteRelease(ctx, rel.id)).environment, "production");
  await assert.rejects(() => promoteRelease(ctx, rel.id));
});
