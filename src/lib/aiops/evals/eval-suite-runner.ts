// Phase 7 — generic eval suite runner. Loads a suite + its cases, dispatches to
// the per-type sub-runner, persists case results + a run with metrics, compares
// against the suite baseline for regression, audits each stage, and raises a
// learning signal on regression/low score. Reproducible (deterministic clock).

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { mean } from "./eval-metrics";
import { getEvalSuite, createEvalRun } from "./eval-run-repository";
import { listCasesForSuite } from "./eval-case-repository";
import { writeCaseResult } from "./eval-result-repository";
import { generateFromEvalRun } from "../learning/learning-signal-generator";
import { runRetrievalCase } from "./runners/retrieval-eval-runner";
import { runExtractionCase } from "./runners/extraction-eval-runner";
import { runClassificationCase } from "./runners/classification-eval-runner";
import { runResponseCase } from "./runners/response-eval-runner";
import { runRecommendationCase } from "./runners/recommendation-eval-runner";
import { runActionCase } from "./runners/action-eval-runner";
import type { ActorContext } from "@/types/platform";
import type { EvalCase, EvalRun, EvalCaseResult } from "@/types/aiops";
import type { CaseOutcome } from "./runners/eval-case-outcome";
import type { EvalRunSummary, EvalSuiteType } from "./eval-production-types";

const RUNNERS: Record<EvalSuiteType, (ctx: ActorContext, c: EvalCase) => Promise<CaseOutcome>> = {
  retrieval: runRetrievalCase,
  extraction: runExtractionCase,
  classification: runClassificationCase,
  response: runResponseCase,
  recommendation: runRecommendationCase,
  action: runActionCase,
};

export interface RunEvalSuiteResult {
  run: EvalRun;
  summary: EvalRunSummary;
}

export async function runEvalSuite(
  ctx: ActorContext,
  evalSuiteId: string,
  opts: { config?: Record<string, unknown>; actorUserId?: string | null } = {},
): Promise<RunEvalSuiteResult> {
  const suite = await getEvalSuite(ctx.tenantId, evalSuiteId);
  if (!suite) throw new Error(`Eval suite not found: ${evalSuiteId}`);

  await emitAudit(ctx, "ai.eval.run.started", { type: "eval_suite", id: suite.id }, {
    suiteType: suite.suiteType,
  });

  const runner = RUNNERS[suite.suiteType];
  const cases = await listCasesForSuite(ctx.tenantId, suite);

  // Persist the run first so case results can reference it.
  const legacyResults: EvalCaseResult[] = [];
  const outcomes: Array<{ caseId: string; outcome: CaseOutcome }> = [];

  try {
    for (const c of cases) {
      const outcome = await runner(ctx, c);
      outcomes.push({ caseId: c.id, outcome });
      legacyResults.push({
        caseId: c.id,
        passed: outcome.passed,
        score: outcome.primaryScore,
        detail: { scores: outcome.scores, errors: outcome.errors },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitAudit(ctx, "ai.eval.run.failed", { type: "eval_suite", id: suite.id }, { error: message });
    throw new Error(`eval suite run failed: ${message}`);
  }

  const averageScore = mean(outcomes.map((o) => o.outcome.primaryScore));
  const passCount = outcomes.filter((o) => o.outcome.passed).length;
  const failCount = outcomes.length - passCount;

  // Regression vs baseline.
  const baseline = typeof suite.baselineConfig.averageScore === "number"
    ? (suite.baselineConfig.averageScore as number)
    : null;
  const regressionDetected = baseline != null && averageScore < baseline - 1e-9;
  const passed = baseline != null ? averageScore >= baseline : failCount === 0;

  // Aggregate metric means across all scored dimensions.
  const metricKeys = new Set<string>();
  outcomes.forEach((o) => Object.keys(o.outcome.scores).forEach((k) => metricKeys.add(k)));
  const metrics: Record<string, number> = { averageScore, passRate: outcomes.length ? passCount / outcomes.length : 0 };
  for (const k of metricKeys) {
    metrics[k] = mean(outcomes.map((o) => o.outcome.scores[k] ?? 0));
  }

  const run = await createEvalRun({
    tenantId: ctx.tenantId,
    suiteType: suite.suiteType,
    evalSuiteId: suite.id,
    targetComponentType: suite.targetComponentType ?? null,
    targetComponentKey: suite.targetComponentKey ?? null,
    results: legacyResults,
    score: averageScore,
    config: opts.config ?? {},
    metrics,
    passed,
    regressionDetected,
    createdBy: opts.actorUserId ?? ctx.actorUserId ?? null,
  });

  // Per-case result rows.
  for (const { caseId, outcome } of outcomes) {
    await writeCaseResult({
      tenantId: ctx.tenantId,
      evalRunId: run.id,
      evalCaseId: caseId,
      status: outcome.errors.length ? "failed" : "completed",
      actual: outcome.actual,
      expected: outcome.expected,
      scores: outcome.scores,
      errors: outcome.errors,
      trace: outcome.trace,
    });
  }

  await emitAudit(ctx, "ai.eval.run.completed", { type: "eval_run", id: run.id }, {
    averageScore,
    passCount,
    failCount,
    regressionDetected,
  });
  if (regressionDetected) {
    await emitAudit(ctx, "ai.eval.regression_detected", { type: "eval_run", id: run.id }, {
      baseline,
      averageScore,
    });
    await generateFromEvalRun(ctx, run);
  } else if (averageScore < 0.6) {
    await generateFromEvalRun(ctx, run);
  }

  const summary: EvalRunSummary = {
    evalRunId: run.id,
    suiteType: suite.suiteType,
    targetComponentType: suite.targetComponentType ?? null,
    targetComponentKey: suite.targetComponentKey ?? null,
    caseCount: outcomes.length,
    passCount,
    failCount,
    averageScore,
    regressionDetected,
    metrics,
  };

  return { run, summary };
}
