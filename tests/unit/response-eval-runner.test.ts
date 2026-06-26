// Phase 7 — response eval runner: groundedness + required facts + forbidden claims.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock, id } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { runResponseCase } from "@/lib/aiops/evals/runners/response-eval-runner";
import type { EvalCase } from "@/types/aiops";

registerFunction({
  key: "test_answer",
  name: "test answer",
  description: "",
  klass: "draft",
  outputSchema: {},
  async run(_ctx, input) {
    return {
      output: { answer: String(input.answerText ?? "") },
      citations: (input.withCitation
        ? [{ objectType: "Doc", objectId: "d1", chunkId: "c1", excerpt: "x", score: 1, method: "keyword" }]
        : []) as never,
    };
  },
});

function makeCase(answerText: string, withCitation: boolean, expected: Record<string, unknown>): EvalCase {
  return {
    id: id("evalcase"),
    tenantId: "tnt_test",
    suiteType: "response",
    input: { functionKey: "test_answer", answerText, withCitation },
    expected,
  };
}

test("grounded answer with required facts passes", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const outcome = await runResponseCase(
    ctx,
    makeCase("The margin risk is high and delivery risk exists.", true, {
      requiredFacts: ["margin risk", "delivery risk"],
      forbiddenClaims: ["guaranteed"],
    }),
  );
  assert.equal(outcome.passed, true);
  assert.equal(outcome.scores.groundedness, 1);
});

test("ungrounded / forbidden answer fails", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const outcome = await runResponseCase(
    ctx,
    makeCase("This is guaranteed with no evidence.", false, {
      requiredFacts: ["margin risk"],
      forbiddenClaims: ["guaranteed"],
    }),
  );
  assert.equal(outcome.passed, false);
  assert.equal(outcome.scores.groundedness, 0);
  assert.ok(outcome.errors.length > 0);
});
