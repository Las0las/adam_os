// Phase 7 — an extraction eval suite runs end to end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { createEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { createEvalCase } from "@/lib/aiops/evals/eval-case-repository";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";

registerFunction({
  key: "claims_extract",
  name: "claims extract",
  description: "",
  klass: "extract",
  outputSchema: {},
  async run() {
    return { output: { fields: { claimAmount: "100", policyNumber: "P1" } } };
  },
});

test("extraction eval suite scores field accuracy", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "claims-extract-eval",
    name: "Claims extraction",
    suiteType: "extraction",
    baselineConfig: { averageScore: 0.9 },
  });
  await createEvalCase({
    tenantId: ctx.tenantId,
    suiteType: "extraction",
    suiteKey: suite.key,
    input: { functionKey: "claims_extract" },
    expected: { fields: { claimAmount: "100", policyNumber: "P1" } },
  });

  const { summary } = await runEvalSuite(ctx, suite.id);
  assert.equal(summary.passCount, 1);
  assert.equal(summary.averageScore, 1);
});
