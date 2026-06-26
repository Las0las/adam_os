// Phase 7 — a retrieval eval suite runs, persists case results, and summarizes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { createEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { createEvalCase } from "@/lib/aiops/evals/eval-case-repository";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";
import { listCaseResults } from "@/lib/aiops/evals/eval-result-repository";

test("retrieval eval suite runs and persists results", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const grace = await upsertObject(ctx, { objectType: "Candidate", externalKey: "grace", title: "Grace" });
  await indexEvidence(ctx, { objectType: "Candidate", objectId: grace.id }, "Compiler inventor and systems programmer");

  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key: "retrieval-suite",
    name: "Retrieval suite",
    suiteType: "retrieval",
    baselineConfig: { averageScore: 0.1 },
  });
  await createEvalCase({
    tenantId: ctx.tenantId,
    suiteType: "retrieval",
    suiteKey: suite.key,
    input: { query: "compiler", methods: ["keyword"] },
    expected: { expectedObjectRefs: [{ objectType: "Candidate", objectId: grace.id }] },
  });

  const { run, summary } = await runEvalSuite(ctx, suite.id);
  assert.equal(summary.caseCount, 1);
  assert.equal(summary.passCount, 1);
  assert.ok(run.score > 0);
  assert.equal(run.passed, true);

  const results = await listCaseResults(ctx.tenantId, run.id);
  assert.equal(results.length, 1);
});
