// Phase 7 — retrieval eval runner computes hit@k / MRR and writes a quality record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock, id } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { runRetrievalCase } from "@/lib/aiops/evals/runners/retrieval-eval-runner";
import type { EvalCase } from "@/types/aiops";

test("retrieval case scores hit@k and MRR and records quality", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const grace = await upsertObject(ctx, { objectType: "Candidate", externalKey: "grace", title: "Grace" });
  await indexEvidence(ctx, { objectType: "Candidate", objectId: grace.id }, "Compiler inventor and systems programmer");

  const evalCase: EvalCase = {
    id: id("evalcase"),
    tenantId: ctx.tenantId,
    suiteType: "retrieval",
    input: { query: "compiler", methods: ["keyword"] },
    expected: { expectedObjectRefs: [{ objectType: "Candidate", objectId: grace.id }] },
  };

  const outcome = await runRetrievalCase(ctx, evalCase);
  assert.equal(outcome.scores.hitAt5, 1);
  assert.ok((outcome.scores.mrr ?? 0) > 0);
  assert.equal(outcome.passed, true);

  const qr = await db.retrievalQualityRecords.list(ctx.tenantId);
  assert.equal(qr.length, 1);
});
