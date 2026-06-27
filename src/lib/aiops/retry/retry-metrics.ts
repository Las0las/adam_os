// IOS-010 — Retry Policy — passive metrics.
//
// A bus subscriber that folds retry.* events into running counters. Collection
// contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isRetryEvent } from "./retry-events";

export interface RetryMetricsSnapshot {
  /** Executions that engaged retry governance. */
  executionsRetried: number;
  /** Failed provider attempts observed under retry. */
  attempts: number;
  /** Executions that succeeded after at least one retry. */
  succeeded: number;
  /** Executions that gave up (max attempts or non-retryable). */
  exhausted: number;
  bypassed: number;
  /** Total backoff delay scheduled across attempts (ms). */
  totalDelayMs: number;
  /** Mean scheduled backoff delay per attempt (ms). */
  averageDelayMs: number;
  /** Attempts keyed by provider. */
  byProvider: Record<string, number>;
  /** Attempts keyed by workload. */
  byWorkload: Record<string, number>;
}

export class RetryMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "retry-metrics";

  private executionsRetried = 0;
  private attempts = 0;
  private succeeded = 0;
  private exhausted = 0;
  private bypassed = 0;
  private totalDelayMs = 0;
  private delaySamples = 0;
  private readonly byProvider = new Map<string, number>();
  private readonly byWorkload = new Map<string, number>();

  onEvent(event: BusEvent): void {
    if (!isRetryEvent(event)) return;
    switch (event.type) {
      case "retry.started":
        this.executionsRetried += 1;
        break;
      case "retry.attempt":
        this.attempts += 1;
        this.totalDelayMs += event.delayMs;
        this.delaySamples += 1;
        this.byProvider.set(event.provider, (this.byProvider.get(event.provider) ?? 0) + 1);
        this.byWorkload.set(event.workloadType, (this.byWorkload.get(event.workloadType) ?? 0) + 1);
        break;
      case "retry.succeeded":
        this.succeeded += 1;
        break;
      case "retry.exhausted":
        this.exhausted += 1;
        break;
      case "retry.bypassed":
        this.bypassed += 1;
        break;
    }
  }

  snapshot(): RetryMetricsSnapshot {
    const project = (m: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of m) out[k] = v;
      return out;
    };
    return {
      executionsRetried: this.executionsRetried,
      attempts: this.attempts,
      succeeded: this.succeeded,
      exhausted: this.exhausted,
      bypassed: this.bypassed,
      totalDelayMs: this.totalDelayMs,
      averageDelayMs: this.delaySamples === 0 ? 0 : this.totalDelayMs / this.delaySamples,
      byProvider: project(this.byProvider),
      byWorkload: project(this.byWorkload),
    };
  }

  reset(): void {
    this.executionsRetried = 0;
    this.attempts = 0;
    this.succeeded = 0;
    this.exhausted = 0;
    this.bypassed = 0;
    this.totalDelayMs = 0;
    this.delaySamples = 0;
    this.byProvider.clear();
    this.byWorkload.clear();
  }
}
