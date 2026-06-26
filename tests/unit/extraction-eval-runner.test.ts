// Phase 7 — extraction eval runner scores field accuracy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock, id } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runExtractionCase } from "@/lib/aiops/evals/runners/extraction-eval-runner";
import type { EvalCase } from "@/types/aiops";

registerFunction({
  key: "test_extract",
  name: "test extract",
  description: "",
  klass: "extract",
  outputSchema: {},
  async run(_ctx, input) {
    return { output: { fields: (input.expectedEcho as Record<string, unknown>) ?? {} } };
  },
});

test("extraction case computes exact match rate", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const evalCase: EvalCase = {
    id: id("evalcase"),
    tenantId: ctx.tenantId,
    suiteType: "extraction",
    input: { functionKey: "test_extract", expectedEcho: { claimAmount: "100", policyNumber: "P1" } },
    expected: { fields: { claimAmount: "100", policyNumber: "P1" } },
  };
  const outcome = await runExtractionCase(ctx, evalCase);
  assert.equal(outcome.scores.exactMatchRate, 1);
  assert.equal(outcome.passed, true);
});

test("extraction case detects a wrong field", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const evalCase: EvalCase = {
    id: id("evalcase"),
    tenantId: ctx.tenantId,
    suiteType: "extraction",
    input: { functionKey: "test_extract", expectedEcho: { claimAmount: "999" } },
    expected: { fields: { claimAmount: "100" } },
  };
  const outcome = await runExtractionCase(ctx, evalCase);
  assert.equal(outcome.scores.exactMatchRate, 0);
  assert.equal(outcome.passed, false);
});
