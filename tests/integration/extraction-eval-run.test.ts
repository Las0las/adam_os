// Exercise the extraction eval SUITE end-to-end against a configured provider:
// runEvalSuite runs every case through extract_candidate_fields and persists a
// scored EvalRun. A stub stands in for a live provider. Also checks that an
// authorized Google model routes to the new adapter (fail-closed without a key).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { createEvalCase } from "@/lib/aiops/evals/eval-case-repository";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";
import { resolveModelProvider } from "@/lib/aiops/models/model-router";
import { setModelProvider, MockModelProvider, type ModelProvider } from "@/lib/aiops/models/model-provider";

function stub(json: Record<string, unknown>): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return { text: JSON.stringify(json), json, promptTokens: 1, completionTokens: 1, latencyMs: 1, costUsd: 0, provider: "stub", modelKey: "stub-1" };
    },
  };
}

const EXPECTED = { fullName: "Dana Diaz", email: "dana@example.test" };

test("runEvalSuite scores the extraction suite against the configured provider", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub(EXPECTED));
  try {
    const ctx = systemActor("tnt_evalrun");
    const suite = await createEvalSuite({
      tenantId: ctx.tenantId,
      key: "candidate_extraction_run",
      name: "Candidate extraction run",
      suiteType: "extraction",
      targetComponentType: "function",
      targetComponentKey: "extract_candidate_fields",
      baselineConfig: { averageScore: 0.7 },
    });
    await createEvalCase({
      tenantId: ctx.tenantId,
      suiteType: "extraction",
      suiteKey: suite.key,
      input: { functionKey: "extract_candidate_fields", text: "Dana Diaz dana@example.test" },
      expected: { fields: EXPECTED },
    });

    const { run } = await runEvalSuite(ctx, suite.id);
    assert.equal(run.results.length, 1, "ran the case");
    assert.equal(run.score, 1, "perfect provider scores 1.0");
    assert.equal(run.results[0]?.passed, true);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("a poor provider drives the suite score down (regression-detectable)", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({})); // returns nothing
  try {
    const ctx = systemActor("tnt_evalrun");
    const suite = await createEvalSuite({
      tenantId: ctx.tenantId,
      key: "candidate_extraction_run",
      name: "Candidate extraction run",
      suiteType: "extraction",
      targetComponentType: "function",
      targetComponentKey: "extract_candidate_fields",
      baselineConfig: { averageScore: 0.7 },
    });
    await createEvalCase({
      tenantId: ctx.tenantId,
      suiteType: "extraction",
      suiteKey: suite.key,
      input: { functionKey: "extract_candidate_fields", text: "Dana Diaz dana@example.test" },
      expected: { fields: EXPECTED },
    });

    const { run } = await runEvalSuite(ctx, suite.id);
    assert.equal(run.score, 0);
    assert.equal(run.results[0]?.passed, false);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("an authorized Google model routes to the new adapter, fail-closed without a key", async () => {
  await resetDatabase();
  resetClock();
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const ctx = systemActor("tnt_google");
  await db.modelDefinitions.insert({
    id: "md_google",
    tenantId: ctx.tenantId,
    provider: "google",
    modelKey: "gemini-2.0-flash",
    purpose: "extraction",
    config: {},
    status: "active",
  });
  await assert.rejects(() => resolveModelProvider(ctx, "extraction"), /GOOGLE_API_KEY/);
});
