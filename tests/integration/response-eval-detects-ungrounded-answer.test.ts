// Phase 7 — response eval fails an ungrounded answer (missing facts / no citation).
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
  key: "ungrounded_answer",
  name: "ungrounded",
  description: "",
  klass: "draft",
  outputSchema: {},
  async run() {
    return { output: { answer: "It is guaranteed." }, citations: [] };
  },
});

test("response eval detects an ungrounded answer", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "resp-eval",
    name: "Response eval",
    suiteType: "response",
    baselineConfig: { averageScore: 0.9 },
  });
  await createEvalCase({
    tenantId: ctx.tenantId,
    suiteType: "response",
    suiteKey: suite.key,
    input: { functionKey: "ungrounded_answer" },
    expected: { requiredFacts: ["margin risk"], forbiddenClaims: ["guaranteed"] },
  });

  const { run, summary } = await runEvalSuite(ctx, suite.id);
  assert.equal(summary.passCount, 0);
  assert.equal(run.passed, false);
});
