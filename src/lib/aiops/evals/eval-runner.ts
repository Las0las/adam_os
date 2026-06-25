// Evaluation harness (§40–§42). First-class evals so retrieval/response quality
// is measured and regressions are visible (§56 hard rule #6).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { retrieve } from "../retrieval/retrieval-service";
import type { ActorContext } from "@/types/platform";
import type { EvalCase, EvalRun, EvalCaseResult } from "@/types/aiops";
import type { RetrievalMethod } from "@/types/dataops";

/** Retrieval eval: does the expected chunk/object appear in the top-k hits? */
export function runRetrievalEvals(
  ctx: ActorContext,
  cases: EvalCase[],
  methods: RetrievalMethod[] = ["rank_fusion"],
): EvalRun {
  const results: EvalCaseResult[] = cases.map((c) => {
    const query = String(c.input.query ?? "");
    const expectedObjectId = String(c.expected.objectId ?? "");
    const response = retrieve(ctx, { tenantId: ctx.tenantId, query, methods, limit: 5 });
    const rank = response.hits.findIndex((h) => h.objectId === expectedObjectId);
    const passed = rank >= 0;
    return {
      caseId: c.id,
      passed,
      score: passed ? 1 / (rank + 1) : 0,
      detail: { rank, returned: response.hits.length },
    };
  });
  return persist(ctx, "retrieval", results);
}

function persist(
  ctx: ActorContext,
  suiteType: EvalCase["suiteType"],
  results: EvalCaseResult[],
): EvalRun {
  const score = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  return db.evalRuns.insert({
    id: id("evalrun"),
    tenantId: ctx.tenantId,
    suiteType,
    results,
    score,
    createdAt: now(),
  });
}
