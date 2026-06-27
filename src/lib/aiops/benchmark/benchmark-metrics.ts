// IOS-014 — Benchmark Harness — passive metrics.
//
// A bus subscriber that folds benchmark.* events into running counters. No
// dashboards, no adaptive routing, no optimization.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isBenchmarkEvent } from "./benchmark-events";

export interface BenchmarkMetricsSnapshot {
  casesExecuted: number;
  successes: number;
  failures: number;
  successRate: number;
  averageLatencyMs: number;
  /** Mean normalized score per provider. */
  providerScore: Record<string, number>;
  /** Mean normalized score per model. */
  modelScore: Record<string, number>;
  failuresByProvider: Record<string, number>;
  failuresByWorkload: Record<string, number>;
}

export class BenchmarkMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "benchmark-metrics";

  private successes = 0;
  private failures = 0;
  private totalLatencyMs = 0;
  private latencySamples = 0;
  private readonly scoreSumByProvider = new Map<string, number>();
  private readonly scoreCountByProvider = new Map<string, number>();
  private readonly scoreSumByModel = new Map<string, number>();
  private readonly scoreCountByModel = new Map<string, number>();
  private readonly failuresByProvider = new Map<string, number>();
  private readonly failuresByWorkload = new Map<string, number>();

  onEvent(event: BusEvent): void {
    if (!isBenchmarkEvent(event)) return;
    if (event.type === "benchmark.case_completed") {
      this.successes += 1;
      this.totalLatencyMs += event.latencyMs;
      this.latencySamples += 1;
      this.scoreSumByProvider.set(event.provider, (this.scoreSumByProvider.get(event.provider) ?? 0) + event.score);
      this.scoreCountByProvider.set(event.provider, (this.scoreCountByProvider.get(event.provider) ?? 0) + 1);
      this.scoreSumByModel.set(event.model, (this.scoreSumByModel.get(event.model) ?? 0) + event.score);
      this.scoreCountByModel.set(event.model, (this.scoreCountByModel.get(event.model) ?? 0) + 1);
    } else if (event.type === "benchmark.case_failed") {
      this.failures += 1;
      this.failuresByProvider.set(event.provider, (this.failuresByProvider.get(event.provider) ?? 0) + 1);
      this.failuresByWorkload.set(event.workloadType, (this.failuresByWorkload.get(event.workloadType) ?? 0) + 1);
    }
  }

  snapshot(): BenchmarkMetricsSnapshot {
    const mean = (sum: Map<string, number>, count: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, s] of sum) out[k] = s / (count.get(k) ?? 1);
      return out;
    };
    const project = (m: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of m) out[k] = v;
      return out;
    };
    const casesExecuted = this.successes + this.failures;
    return {
      casesExecuted,
      successes: this.successes,
      failures: this.failures,
      successRate: casesExecuted === 0 ? 0 : this.successes / casesExecuted,
      averageLatencyMs: this.latencySamples === 0 ? 0 : this.totalLatencyMs / this.latencySamples,
      providerScore: mean(this.scoreSumByProvider, this.scoreCountByProvider),
      modelScore: mean(this.scoreSumByModel, this.scoreCountByModel),
      failuresByProvider: project(this.failuresByProvider),
      failuresByWorkload: project(this.failuresByWorkload),
    };
  }

  reset(): void {
    this.successes = 0;
    this.failures = 0;
    this.totalLatencyMs = 0;
    this.latencySamples = 0;
    this.scoreSumByProvider.clear();
    this.scoreCountByProvider.clear();
    this.scoreSumByModel.clear();
    this.scoreCountByModel.clear();
    this.failuresByProvider.clear();
    this.failuresByWorkload.clear();
  }
}
