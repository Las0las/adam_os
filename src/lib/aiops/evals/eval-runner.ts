// Evaluation harness (§40–§42). First-class evals so retrieval/response quality
// is measured and regressions are visible (§56 hard rule #6).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { retrieve } from "../retrieval/retrieval-service";
import { runFunction } from "../functions/function-runner";
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

/**
 * Extraction eval: run a function and compare extracted fields against expected.
 * Score = fraction of expected key/value pairs matched in the output.
 */
export async function runExtractionEvals(
  ctx: ActorContext,
  functionKey: string,
  cases: EvalCase[],
): Promise<EvalRun> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    const run = await runFunction(ctx, functionKey, c.input);
    const output = (run.output ?? {}) as Record<string, unknown>;
    const expected = c.expected;
    const keys = Object.keys(expected);
    const matched = keys.filter((k) => String(output[k]) === String(expected[k])).length;
    const score = keys.length ? matched / keys.length : 0;
    results.push({
      caseId: c.id,
      passed: score === 1,
      score,
      detail: { matched, total: keys.length, status: run.status },
    });
  }
  return persist(ctx, "extraction", results);
}

/**
 * Response eval: run a response/draft function and score on expected keyword
 * coverage in the produced text — a lightweight, deterministic rubric.
 */
export async function runResponseEvals(
  ctx: ActorContext,
  functionKey: string,
  cases: EvalCase[],
): Promise<EvalRun> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    const run = await runFunction(ctx, functionKey, c.input);
    const output = (run.output ?? {}) as Record<string, unknown>;
    const text = String(output.answer ?? output.draft ?? "").toLowerCase();
    const keywords = (c.expected.keywords as string[] | undefined) ?? [];
    const hits = keywords.filter((k) => text.includes(k.toLowerCase())).length;
    const score = keywords.length ? hits / keywords.length : run.status === "completed" ? 1 : 0;
    results.push({
      caseId: c.id,
      passed: score >= 0.5,
      score,
      detail: { hits, total: keywords.length, citations: run.citations?.length ?? 0 },
    });
  }
  return persist(ctx, "response", results);
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
