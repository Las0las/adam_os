// Extraction eval harness for candidate extraction. Runs the eval case through
// the same `extract_candidate_fields` function the paste-a-profile flow uses and
// scores field accuracy. A stub model stands in for a real provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runExtractionCase } from "@/lib/aiops/evals/runners/extraction-eval-runner";
import { installEvalSuites } from "@/lib/aiops/evals/eval-seed";
import { setModelProvider, MockModelProvider, type ModelProvider } from "@/lib/aiops/models/model-provider";
import type { EvalCase } from "@/types/aiops";

function stub(json: Record<string, unknown>): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return { text: JSON.stringify(json), json, promptTokens: 1, completionTokens: 1, latencyMs: 1, costUsd: 0, provider: "stub", modelKey: "stub-1" };
    },
  };
}

const EXPECTED = { fullName: "Dana Diaz", email: "dana@example.test", currentTitle: "Staff Engineer" };

function evalCase(): EvalCase {
  return {
    id: "ec1",
    tenantId: "tnt_eval",
    suiteType: "extraction",
    input: { functionKey: "extract_candidate_fields", text: "Dana Diaz — Staff Engineer. dana@example.test" },
    expected: { fields: EXPECTED },
  };
}

test("a perfect extraction scores 1.0 and passes", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub(EXPECTED));
  try {
    const ctx = systemActor("tnt_eval");
    const outcome = await runExtractionCase(ctx, evalCase());
    assert.equal(outcome.primaryScore, 1);
    assert.equal(outcome.passed, true);
    assert.equal((outcome.scores as { missingFieldRate: number }).missingFieldRate, 0);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("an empty extraction scores 0 and fails (every field missing)", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({}));
  try {
    const ctx = systemActor("tnt_eval");
    const outcome = await runExtractionCase(ctx, evalCase());
    assert.equal(outcome.primaryScore, 0);
    assert.equal(outcome.passed, false);
    assert.equal((outcome.scores as { missingFieldRate: number }).missingFieldRate, 1);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("a partial extraction scores between 0 and 1", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ fullName: "Dana Diaz", email: "dana@example.test" })); // missing currentTitle
  try {
    const ctx = systemActor("tnt_eval");
    const outcome = await runExtractionCase(ctx, evalCase());
    assert.equal(Number(outcome.primaryScore.toFixed(2)), 0.67); // 2 of 3 fields exact
    assert.equal(outcome.passed, false);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("the candidate-extraction eval suite is seeded with labeled cases", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_eval");
  await installEvalSuites(ctx);
  const suite = await db.evalSuites.find(ctx.tenantId, (x) => x.key === "recruiting_candidate_extraction");
  assert.ok(suite, "suite seeded");
  assert.equal(suite?.targetComponentKey, "extract_candidate_fields");
  const cases = await db.evalCases.list(ctx.tenantId, (c) => c.suiteType === "extraction");
  assert.ok(cases.length >= 3, "labeled extraction cases seeded");
});
