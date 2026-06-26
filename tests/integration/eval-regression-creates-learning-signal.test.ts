// Phase 7 — an eval run below baseline is flagged as a regression and raises a
// learning signal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { createEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { createEvalCase } from "@/lib/aiops/evals/eval-case-repository";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";

registerFunction({
  key: "weak_extract",
  name: "weak extract",
  description: "",
  klass: "extract",
  outputSchema: {},
  async run() {
    return { output: { fields: { a: "wrong" } } };
  },
});

test("regression vs baseline creates a learning signal", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "regress-eval",
    name: "Regress eval",
    suiteType: "extraction",
    targetComponentType: "function",
    targetComponentKey: "weak_extract",
    baselineConfig: { averageScore: 0.9 }, // high baseline -> low run regresses
  });
  await createEvalCase({
    tenantId: ctx.tenantId,
    suiteType: "extraction",
    suiteKey: suite.key,
    input: { functionKey: "weak_extract" },
    expected: { fields: { a: "right" } },
  });

  const { run } = await runEvalSuite(ctx, suite.id);
  assert.equal(run.regressionDetected, true);

  const signals = await db.learningSignals.list(ctx.tenantId, (s) => s.createdFromEvalRunId === run.id);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.signalType, "extraction_gap");
});
