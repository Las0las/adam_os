// IOS-017 — Evaluation Engine — passive metrics (evaluation-scoped).
//
// A subscriber on the EVALUATION bus that folds evaluation.* events into counters.
// Attached only to the evaluation bus, isolated from production metrics.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isEvaluationEvent } from "./evaluation-events";

export interface EvaluationMetricsSnapshot {
  evaluations: number;
  subjectsEvaluated: number;
  passed: number;
  failed: number;
  passRate: number;
}

export class EvaluationMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "evaluation-metrics";

  private evaluations = 0;
  private passed = 0;
  private failed = 0;

  onEvent(event: BusEvent): void {
    if (!isEvaluationEvent(event)) return;
    if (event.type === "evaluation.started") this.evaluations += 1;
    else if (event.type === "evaluation.subject_evaluated") {
      if (event.passed) this.passed += 1; else this.failed += 1;
    }
  }

  snapshot(): EvaluationMetricsSnapshot {
    const subjectsEvaluated = this.passed + this.failed;
    return {
      evaluations: this.evaluations,
      subjectsEvaluated,
      passed: this.passed,
      failed: this.failed,
      passRate: subjectsEvaluated === 0 ? 0 : this.passed / subjectsEvaluated,
    };
  }

  reset(): void {
    this.evaluations = 0;
    this.passed = 0;
    this.failed = 0;
  }
}
