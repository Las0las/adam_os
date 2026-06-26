// Phase 7 — a prod release of an eval-gated component is blocked when its latest
// eval failed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { createEnvironment } from "@/lib/mission-control/runtime/environment-repository";
import { createEvalSuite, createEvalRun } from "@/lib/aiops/evals/eval-run-repository";
import { createReleaseBundle } from "@/lib/mission-control/deployments/release-bundle-service";
import { validateReleaseBundle } from "@/lib/mission-control/deployments/release-validation-service";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";

test("prod release blocked when latest eval failed", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createEnvironment({ tenantId: ctx.tenantId, key: "prod", name: "Prod", environmentType: "prod" });

  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "fn-eval",
    name: "fn eval",
    suiteType: "response",
    targetComponentType: "function",
    targetComponentKey: "answer_with_citations",
    baselineConfig: { averageScore: 0.8 },
  });
  await createEvalRun({
    tenantId: ctx.tenantId,
    suiteType: "response",
    evalSuiteId: suite.id,
    targetComponentType: "function",
    targetComponentKey: "answer_with_citations",
    results: [],
    score: 0.2,
    passed: false,
    regressionDetected: true,
  });

  const { release } = await createReleaseBundle(ctx, {
    key: "r1",
    name: "r1",
    releaseType: "function",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "function", itemKey: "answer_with_citations", changeType: "update" }],
  });

  const result = await validateReleaseBundle(ctx, release.id);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some((b) => /eval/.test(b) && /regress|fail/.test(b)));
});

test("prod release blocked when no eval exists for a gated item", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  await createEnvironment({ tenantId: ctx.tenantId, key: "prod", name: "Prod", environmentType: "prod" });
  const { release } = await createReleaseBundle(ctx, {
    key: "r2",
    name: "r2",
    releaseType: "agent",
    targetEnvironmentKey: "prod",
    items: [{ itemType: "agent", itemKey: "ungated_agent", changeType: "update" }],
  });
  const result = await validateReleaseBundle(ctx, release.id);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some((b) => /no eval/.test(b)));
});
