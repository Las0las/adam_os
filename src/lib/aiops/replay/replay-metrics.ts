// IOS-016 — Traffic Replay Engine — passive metrics (replay-scoped).
//
// A subscriber on the REPLAY bus that folds replay.* events into counters. It is
// attached ONLY to the replay bus, so it counts replay activity in isolation and
// never mixes with production metrics.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isReplayEvent } from "./replay-events";

export interface ReplayMetricsSnapshot {
  runs: number;
  recordsReplayed: number;
  successes: number;
  failures: number;
  successRate: number;
  averageLatencyMs: number;
}

export class ReplayMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "replay-metrics";

  private runs = 0;
  private successes = 0;
  private failures = 0;
  private totalLatencyMs = 0;
  private latencySamples = 0;

  onEvent(event: BusEvent): void {
    if (!isReplayEvent(event)) return;
    if (event.type === "replay.run_started") this.runs += 1;
    else if (event.type === "replay.record_completed") {
      this.successes += 1;
      this.totalLatencyMs += event.latencyMs;
      this.latencySamples += 1;
    } else if (event.type === "replay.record_failed") {
      this.failures += 1;
    }
  }

  snapshot(): ReplayMetricsSnapshot {
    const recordsReplayed = this.successes + this.failures;
    return {
      runs: this.runs,
      recordsReplayed,
      successes: this.successes,
      failures: this.failures,
      successRate: recordsReplayed === 0 ? 0 : this.successes / recordsReplayed,
      averageLatencyMs: this.latencySamples === 0 ? 0 : this.totalLatencyMs / this.latencySamples,
    };
  }

  reset(): void {
    this.runs = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalLatencyMs = 0;
    this.latencySamples = 0;
  }
}
