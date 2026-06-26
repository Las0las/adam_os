// Phase 7 — learning signals generated from eval regression and repeated feedback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createEvalRun } from "@/lib/aiops/evals/eval-run-repository";
import { generateFromEvalRun } from "@/lib/aiops/learning/learning-signal-generator";
import { recordFeedback } from "@/lib/aiops/learning/human-feedback-service";

test("eval regression creates a learning signal", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const run = await createEvalRun({
    tenantId: ctx.tenantId,
    suiteType: "retrieval",
    targetComponentType: "function",
    targetComponentKey: "answer_with_citations",
    results: [],
    score: 0.3,
    regressionDetected: true,
    passed: false,
  });
  const signal = await generateFromEvalRun(ctx, run);
  assert.ok(signal);
  assert.equal(signal!.signalType, "retrieval_gap");
  assert.equal(signal!.severity, "high");
});

test("repeated extraction corrections create a signal (deduped)", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await recordFeedback(ctx, {
    feedbackType: "extraction_correction",
    subjectType: "function_run",
    subjectId: "r1",
    objectType: "ClaimDocument",
    correction: { claimAmount: "100" },
  });
  const second = await recordFeedback(ctx, {
    feedbackType: "extraction_correction",
    subjectType: "function_run",
    subjectId: "r2",
    objectType: "ClaimDocument",
    correction: { claimAmount: "200" },
  });
  assert.ok(second.signal, "second repeated correction should raise a signal");
  assert.equal(second.signal!.signalType, "extraction_gap");

  // A third correction must not create a duplicate open signal.
  const third = await recordFeedback(ctx, {
    feedbackType: "extraction_correction",
    subjectType: "function_run",
    subjectId: "r3",
    objectType: "ClaimDocument",
    correction: { claimAmount: "300" },
  });
  assert.equal(third.signal, null);
  const signals = await db.learningSignals.list(ctx.tenantId);
  assert.equal(signals.length, 1);
});
