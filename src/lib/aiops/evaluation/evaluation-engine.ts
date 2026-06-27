// IOS-017 — Evaluation Engine.
//
// Observational/evaluative: it scores COMPLETED executions (produced within an
// Isolated Execution Environment, IOS-016 model) and produces the canonical
// EvaluationResult / EvaluationReport. It reads canonical objects (ReplayResult,
// Explanation, execution outcomes) by reference and NEVER influences execution or
// routing, authorizes targets, or invokes providers directly. It publishes
// evaluation.* events on its EVALUATION-SCOPED bus only — production health/metrics
// are never contaminated. Default policy DISABLED.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import type { ExplanationStore } from "@/lib/aiops/explainability/explanation-store";
import type { ReplayRun } from "@/lib/aiops/replay/replay-types";
import { scoreSubject } from "./evaluation-scorer";
import { evaluationStarted, evaluationSubjectEvaluated, evaluationCompleted } from "./evaluation-events";
import type { EvaluationStore } from "./evaluation-store";
import {
  evaluationEligible,
  type EvaluationExpectation,
  type EvaluationPolicyStore,
  type EvaluationReport,
  type EvaluationResult,
  type EvaluationSubject,
} from "./evaluation-types";

export interface EvaluationEngineDeps {
  now?: () => number;
  newEvaluationId?: () => string;
}

export class EvaluationEngine {
  private readonly now: () => number;
  private readonly newEvaluationId: () => string;

  constructor(
    /** The EVALUATION-SCOPED bus — isolated from the production bus. */
    private readonly bus: ExecutionEventBus,
    private readonly store: EvaluationStore,
    private readonly policyStore: EvaluationPolicyStore,
    deps: EvaluationEngineDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
    this.newEvaluationId = deps.newEvaluationId ?? (() => id("eval"));
  }

  /**
   * Score a set of completed-execution subjects and produce the canonical
   * EvaluationReport. Observational — it reads the subjects, never mutating them or
   * any canonical object. A no-op (null) when the policy is disabled.
   */
  evaluate(subjects: EvaluationSubject[]): EvaluationReport | null {
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return null;

    const evaluationId = this.newEvaluationId();
    const eligible = subjects
      .filter((s) => evaluationEligible(policy, s.provider, s.workloadType))
      .slice(0, Math.max(0, policy.maxSubjects));
    guard(() => this.bus.publish(evaluationStarted(evaluationId, eligible.length)));

    const observedAt = this.now();
    const results: EvaluationResult[] = eligible.map((s) => {
      const scored = scoreSubject(policy.criteria, s);
      const result: EvaluationResult = deepFreeze({
        evaluationId,
        subjectId: s.subjectId,
        provider: s.provider,
        model: s.model,
        workloadType: s.workloadType,
        passed: scored.passed,
        score: scored.score,
        criteria: scored.outcomes,
        observedAt,
      });
      this.store.addResult(result);
      guard(() => this.bus.publish(evaluationSubjectEvaluated(evaluationId, s.provider, s.model, s.workloadType, s.subjectId, scored.passed, scored.score)));
      return result;
    });

    const report = this.aggregate(evaluationId, results, observedAt);
    this.store.addReport(report);
    guard(() => this.bus.publish(evaluationCompleted(evaluationId, report.total, report.passed)));
    return report;
  }

  /**
   * Evaluate the executions of an IOS-016 ReplayRun (an Isolated Execution
   * Environment): builds subjects from each immutable ReplayResult, optionally
   * enriched with the replay-scoped Explanation (fallback signal), then scores
   * them. Consumes ReplayResult + Explanation; mutates neither.
   */
  evaluateReplayRun(
    run: ReplayRun,
    expectedByRecordId: Record<string, EvaluationExpectation> = {},
    explanations?: ExplanationStore,
  ): EvaluationReport | null {
    const subjects: EvaluationSubject[] = run.results.map((r) => {
      const explanation = explanations?.get(r.replayExecutionId) ?? null;
      return {
        subjectId: r.recordId,
        provider: r.provider,
        model: r.model,
        workloadType: r.workloadType,
        success: r.success,
        errorKind: r.errorKind,
        latencyMs: r.latencyMs,
        response: null, // canonical observations do not retain response text
        fallbackOccurred: explanation?.fallback.occurred ?? false,
        expected: expectedByRecordId[r.recordId],
      };
    });
    return this.evaluate(subjects);
  }

  private aggregate(evaluationId: string, results: EvaluationResult[], observedAt: number): EvaluationReport {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const sumScore = results.reduce((a, r) => a + r.score, 0);
    const byProviderAgg = new Map<string, { passed: number; count: number; score: number }>();
    for (const r of results) {
      const agg = byProviderAgg.get(r.provider) ?? { passed: 0, count: 0, score: 0 };
      agg.passed += r.passed ? 1 : 0;
      agg.count += 1;
      agg.score += r.score;
      byProviderAgg.set(r.provider, agg);
    }
    const byProvider: Record<string, { passRate: number; averageScore: number }> = {};
    for (const [p, agg] of byProviderAgg) {
      byProvider[p] = { passRate: agg.count === 0 ? 0 : agg.passed / agg.count, averageScore: agg.count === 0 ? 0 : agg.score / agg.count };
    }
    return deepFreeze({
      evaluationId,
      total,
      passed,
      failed: total - passed,
      passRate: total === 0 ? 0 : passed / total,
      averageScore: total === 0 ? 0 : sumScore / total,
      byProvider,
      results,
      observedAt,
    });
  }
}
