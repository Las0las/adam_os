// IOS-011 — Circuit Breaker — passive metrics.
//
// A bus subscriber that folds circuit.* events into running counters. Collection
// contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isCircuitEvent } from "./circuit-events";

export interface CircuitMetricsSnapshot {
  /** Times a circuit transitioned closed/half_open → open. */
  opened: number;
  /** Times a circuit transitioned half_open → closed. */
  closed: number;
  /** Times a circuit transitioned open → half_open (probe admitted). */
  halfOpened: number;
  /** Calls fast-failed because the circuit was open. */
  rejected: number;
  /** Rejections keyed by provider. */
  byProvider: Record<string, number>;
  /** Rejections keyed by workload. */
  byWorkload: Record<string, number>;
}

export class CircuitMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "circuit-metrics";

  private opened = 0;
  private closed = 0;
  private halfOpened = 0;
  private rejected = 0;
  private readonly byProvider = new Map<string, number>();
  private readonly byWorkload = new Map<string, number>();

  onEvent(event: BusEvent): void {
    if (!isCircuitEvent(event)) return;
    switch (event.type) {
      case "circuit.opened":
        this.opened += 1;
        break;
      case "circuit.closed":
        this.closed += 1;
        break;
      case "circuit.half_opened":
        this.halfOpened += 1;
        break;
      case "circuit.rejected":
        this.rejected += 1;
        this.byProvider.set(event.provider, (this.byProvider.get(event.provider) ?? 0) + 1);
        this.byWorkload.set(event.workloadType, (this.byWorkload.get(event.workloadType) ?? 0) + 1);
        break;
    }
  }

  snapshot(): CircuitMetricsSnapshot {
    const project = (m: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of m) out[k] = v;
      return out;
    };
    return {
      opened: this.opened,
      closed: this.closed,
      halfOpened: this.halfOpened,
      rejected: this.rejected,
      byProvider: project(this.byProvider),
      byWorkload: project(this.byWorkload),
    };
  }

  reset(): void {
    this.opened = 0;
    this.closed = 0;
    this.halfOpened = 0;
    this.rejected = 0;
    this.byProvider.clear();
    this.byWorkload.clear();
  }
}
