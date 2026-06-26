// Phase 7 — retrieval eval. Runs retrieval and scores hit@k, MRR, and citation
// coverage against the expected object refs; also writes a retrieval quality
// record for the closed loop.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { retrieve } from "../../retrieval/retrieval-service";
import { hitAtK, reciprocalRank, citationCoverage } from "../eval-metrics";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { RetrievalMethod } from "@/types/dataops";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runRetrievalCase(ctx: ActorContext, evalCase: EvalCase): Promise<CaseOutcome> {
  const query = String(evalCase.input.query ?? "");
  const methods = (evalCase.input.methods as RetrievalMethod[] | undefined) ?? ["rank_fusion"];
  const objectTypes = evalCase.input.objectTypes as string[] | undefined;
  const expectedRefs =
    (evalCase.expected.expectedObjectRefs as Array<{ objectType: string; objectId: string }> | undefined) ??
    (evalCase.expected.objectId ? [{ objectType: "", objectId: String(evalCase.expected.objectId) }] : []);
  const expectedIds = expectedRefs.map((r) => r.objectId);

  const response = await retrieve(ctx, { tenantId: ctx.tenantId, query, methods, objectTypes, limit: 5 });
  const ranked = response.hits.map((h) => h.objectId);

  const scores = {
    hitAt1: hitAtK(ranked, expectedIds, 1),
    hitAt3: hitAtK(ranked, expectedIds, 3),
    hitAt5: hitAtK(ranked, expectedIds, 5),
    mrr: reciprocalRank(ranked, expectedIds),
    citationCoverage: citationCoverage(ranked, expectedIds),
  };

  await db.retrievalQualityRecords.insert({
    id: id("rqr"),
    tenantId: ctx.tenantId,
    runType: "eval",
    runId: evalCase.id,
    query,
    methods,
    hits: response.hits.map((h) => ({ objectId: h.objectId, score: h.score, method: h.method })),
    expectedObjectRefs: expectedRefs,
    metrics: scores,
    createdAt: now(),
  });

  return {
    actual: { ranked, hitCount: ranked.length },
    expected: { expectedObjectRefs: expectedRefs },
    scores,
    primaryScore: scores.mrr,
    passed: scores.hitAt5 === 1,
    errors: [],
    trace: { query, methods },
  };
}
