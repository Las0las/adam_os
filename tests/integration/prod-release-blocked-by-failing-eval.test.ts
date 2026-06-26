// Phase 7 — submitting a prod release whose component eval failed is blocked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { createEvalSuite, createEvalRun } from "@/lib/aiops/evals/eval-run-repository";
import {
  createReleaseBundle,
  submitReleaseForApproval,
} from "@/lib/mission-control/deployments/release-bundle-service";
import { setupGovernance } from "../helpers/mc-flow";

test("prod release with a failing eval cannot be submitted", async () => {
  await resetDatabase();
  resetClock();
  const ctx = await setupGovernance();

  // A failing eval for a fresh function component.
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "bad-fn-eval",
    name: "bad",
    suiteType: "response",
    targetComponentType: "function",
    targetComponentKey: "risky_fn",
    baselineConfig: { averageScore: 0.9 },
  });
  await createEvalRun({
    tenantId: ctx.tenantId,
    suiteType: "response",
    evalSuiteId: suite.id,
    targetComponentType: "function",
    targetComponentKey: "risky_fn",
    results: [],
    score: 0.1,
    passed: false,
    regressionDetected: true,
  });

  const { release } = await createReleaseBundle(ctx, {
    key: "risky-release",
    name: "Risky",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "risky_fn", changeType: "update" }],
  });

  const submit = await submitReleaseForApproval(ctx, release.id);
  assert.equal(submit.submitted, false);
  assert.ok(submit.validation.blockers.some((b) => /eval/.test(b)));
});
