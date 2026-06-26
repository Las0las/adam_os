// Execution Observability (Milestone 5.0, deliverable #3) — metrics collector.
//
// A passive collector that consumes canonical ExecutionEvents and maintains
// running counters. It establishes the COLLECTION CONTRACT only: it does not
// expose dashboards, does not aggregate historically (no time buckets / windows
// / percentiles over history), and does not persist. It simply accumulates the
// totals every downstream surface (future dashboards, benchmarking, governance)
// will read.
//
// It records `completed` and `failed` events. `started` events advance no
// counter here — totals are counted at terminal state so success + failure
// always reconcile with total executions.
//
// Since Milestone 5.5 the collector is a BUS SUBSCRIBER: `onEvent` is the
// subscription entry point and folds each event into the running totals.

import { isExecutionEvent, type ExecutionEvent } from "./execution-events";
import type { BusEvent, ExecutionEventSubscriber } from "./execution-event-bus";

/** Per-key usage tally (provider id or model key). */
export interface UsageTally {
  executions: number;
  successes: number;
  failures: number;
}

/** A point-in-time snapshot of the collected counters. All values are running
 *  totals since process start (or last reset) — never historical series. */
export interface MetricsSnapshot {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  providerUsage: Record<string, UsageTally>;
  modelUsage: Record<string, UsageTally>;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Summed completion cost in USD. */
  totalCostUsd: number;
  /** Summed execution latency in ms (completed executions). */
  latencyMsTotal: number;
  /** Summed end-to-end execution duration in ms (completed + failed). */
  durationMsTotal: number;
}

function emptyTally(): UsageTally {
  return { executions: 0, successes: 0, failures: 0 };
}

export class MetricsCollector implements ExecutionEventSubscriber {
  readonly name = "metrics";

  private totalExecutions = 0;
  private successCount = 0;
  private failureCount = 0;
  private readonly providerUsage = new Map<string, UsageTally>();
  private readonly modelUsage = new Map<string, UsageTally>();
  private promptTokens = 0;
  private completionTokens = 0;
  private totalTokens = 0;
  private totalCostUsd = 0;
  private latencyMsTotal = 0;
  private durationMsTotal = 0;

  private tally(map: Map<string, UsageTally>, key: string, success: boolean): void {
    const t = map.get(key) ?? emptyTally();
    t.executions += 1;
    if (success) t.successes += 1;
    else t.failures += 1;
    map.set(key, t);
  }

  /** Bus subscription entry point — folds execution events into the running
   *  totals. Non-execution events (e.g. security events) are ignored. */
  onEvent(event: BusEvent): void {
    if (isExecutionEvent(event)) this.record(event);
  }

  /** Fold one canonical event into the running totals. `started` is ignored —
   *  executions are counted at terminal state. */
  record(event: ExecutionEvent): void {
    if (event.type === "execution.started") return;

    const success = event.type === "execution.completed";
    this.totalExecutions += 1;
    if (success) this.successCount += 1;
    else this.failureCount += 1;
    this.tally(this.providerUsage, event.provider, success);
    this.tally(this.modelUsage, event.model, success);

    if (event.type === "execution.completed") {
      this.latencyMsTotal += event.latency;
      this.durationMsTotal += event.latency;
      if (event.usage) {
        this.promptTokens += event.usage.promptTokens;
        this.completionTokens += event.usage.completionTokens;
        this.totalTokens += event.usage.totalTokens;
        this.totalCostUsd += event.usage.costUsd;
      }
    }
  }

  snapshot(): MetricsSnapshot {
    const project = (map: Map<string, UsageTally>): Record<string, UsageTally> => {
      const out: Record<string, UsageTally> = {};
      for (const [k, v] of map) out[k] = { ...v };
      return out;
    };
    return {
      totalExecutions: this.totalExecutions,
      successCount: this.successCount,
      failureCount: this.failureCount,
      providerUsage: project(this.providerUsage),
      modelUsage: project(this.modelUsage),
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
      totalCostUsd: this.totalCostUsd,
      latencyMsTotal: this.latencyMsTotal,
      durationMsTotal: this.durationMsTotal,
    };
  }

  reset(): void {
    this.totalExecutions = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.providerUsage.clear();
    this.modelUsage.clear();
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
    this.totalCostUsd = 0;
    this.latencyMsTotal = 0;
    this.durationMsTotal = 0;
  }
}
