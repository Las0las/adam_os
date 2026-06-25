import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { indexEvidence, splitIntoChunks } from "@/lib/dataops/evidence/chunking-service";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { runRetrievalEvals } from "@/lib/aiops/evals/eval-runner";
import { id } from "@/lib/lawrence-core/utils/ids";

function seedEvidence() {
  resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const ada = upsertObject(ctx, { objectType: "Candidate", externalKey: "ada", title: "Ada" });
  const grace = upsertObject(ctx, { objectType: "Candidate", externalKey: "grace", title: "Grace" });
  indexEvidence(ctx, { objectType: "Candidate", objectId: ada.id }, "Analytical engine pioneer and mathematician");
  indexEvidence(ctx, { objectType: "Candidate", objectId: grace.id }, "Compiler inventor and systems programmer");
  return { ctx, ada, grace };
}

test("splitIntoChunks packs paragraphs", () => {
  const chunks = splitIntoChunks("para one\n\npara two\n\npara three", 20);
  assert.ok(chunks.length >= 2);
});

test("keyword retrieval finds the matching candidate", () => {
  const { ctx, grace } = seedEvidence();
  const res = retrieve(ctx, { tenantId: ctx.tenantId, query: "compiler", methods: ["keyword"] });
  assert.ok(res.hits.length > 0);
  assert.equal(res.hits[0]!.objectId, grace.id);
  assert.equal(res.hits[0]!.method, "keyword");
});

test("rank_fusion retrieval returns scored, citeable hits", () => {
  const { ctx, ada } = seedEvidence();
  const res = retrieve(ctx, { tenantId: ctx.tenantId, query: "mathematician engine", methods: ["rank_fusion"] });
  assert.ok(res.hits.length > 0);
  assert.equal(res.hits[0]!.objectId, ada.id);
  assert.ok(res.hits[0]!.chunkId);
  assert.ok(res.hits[0]!.excerpt.length > 0);
});

test("answer_with_citations returns citations used", async () => {
  const { ctx } = seedEvidence();
  const run = await runFunction(ctx, "answer_with_citations", {
    question: "who invented compilers",
    objectTypes: ["Candidate"],
  });
  assert.equal(run.status, "completed");
  assert.ok((run.citations?.length ?? 0) > 0);
});

test("retrieval eval scores reciprocal rank", () => {
  const { ctx, grace } = seedEvidence();
  const run = runRetrievalEvals(ctx, [
    {
      id: id("evalcase"),
      tenantId: ctx.tenantId,
      suiteType: "retrieval",
      input: { query: "systems programmer" },
      expected: { objectId: grace.id },
    },
  ]);
  assert.ok(run.score > 0);
  assert.equal(run.results[0]!.passed, true);
});
