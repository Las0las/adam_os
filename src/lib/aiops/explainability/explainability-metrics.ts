// IOS-015 — Explainability Engine — passive metrics.
//
// A bus subscriber that folds explanation.produced events into running counters.
// No dashboards, no persistence beyond the Explanation store.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isExplanationEvent } from "./explainability-events";

export interface ExplainabilityMetricsSnapshot {
  produced: number;
  successes: number;
  failures: number;
  withRetry: number;
  withFallback: number;
  cacheHits: number;
  securityRejections: number;
}

export class ExplainabilityMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "explainability-metrics";

  private produced = 0;
  private successes = 0;
  private failures = 0;
  private withRetry = 0;
  private withFallback = 0;
  private cacheHits = 0;
  private securityRejections = 0;

  onEvent(event: BusEvent): void {
    if (!isExplanationEvent(event)) return;
    const e = event.explanation;
    this.produced += 1;
    if (e.outcome.success) this.successes += 1; else this.failures += 1;
    if (e.retry.attempts > 0) this.withRetry += 1;
    if (e.fallback.occurred) this.withFallback += 1;
    if (e.cache.hit) this.cacheHits += 1;
    if (e.security.promptOutcome === "rejected" || e.security.validation === "failed") this.securityRejections += 1;
  }

  snapshot(): ExplainabilityMetricsSnapshot {
    return {
      produced: this.produced,
      successes: this.successes,
      failures: this.failures,
      withRetry: this.withRetry,
      withFallback: this.withFallback,
      cacheHits: this.cacheHits,
      securityRejections: this.securityRejections,
    };
  }

  reset(): void {
    this.produced = 0;
    this.successes = 0;
    this.failures = 0;
    this.withRetry = 0;
    this.withFallback = 0;
    this.cacheHits = 0;
    this.securityRejections = 0;
  }
}
