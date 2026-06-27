// IOS-012 — Fallback Orchestrator — passive metrics.
//
// A bus subscriber that folds fallback.* events into running counters. Collection
// contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isFallbackEvent } from "./fallback-events";

export interface FallbackMetricsSnapshot {
  /** Executions that engaged fallback (primary failed eligibly). */
  started: number;
  /** Alternate-target attempts made. */
  attempts: number;
  /** Executions recovered by a fallback target. */
  succeeded: number;
  /** Executions where the whole fallback chain was exhausted. */
  exhausted: number;
  bypassed: number;
  /** succeeded / started (0 when none started). */
  successRate: number;
  /** Total fallback latency across succeeded + exhausted executions (ms). */
  totalLatencyMs: number;
  /** Mean fallback latency per resolved execution (ms). */
  averageLatencyMs: number;
  /** Provider transitions `primary->target`, counted on success. */
  transitions: Record<string, number>;
}

export class FallbackMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "fallback-metrics";

  private started = 0;
  private attempts = 0;
  private succeeded = 0;
  private exhausted = 0;
  private bypassed = 0;
  private totalLatencyMs = 0;
  private latencySamples = 0;
  private readonly transitions = new Map<string, number>();

  onEvent(event: BusEvent): void {
    if (!isFallbackEvent(event)) return;
    switch (event.type) {
      case "fallback.started":
        this.started += 1;
        break;
      case "fallback.attempt":
        this.attempts += 1;
        break;
      case "fallback.succeeded": {
        this.succeeded += 1;
        this.totalLatencyMs += event.latencyMs;
        this.latencySamples += 1;
        const key = `${event.provider}->${event.targetProvider}`;
        this.transitions.set(key, (this.transitions.get(key) ?? 0) + 1);
        break;
      }
      case "fallback.exhausted":
        this.exhausted += 1;
        this.totalLatencyMs += event.latencyMs;
        this.latencySamples += 1;
        break;
      case "fallback.bypassed":
        this.bypassed += 1;
        break;
    }
  }

  snapshot(): FallbackMetricsSnapshot {
    const transitions: Record<string, number> = {};
    for (const [k, v] of this.transitions) transitions[k] = v;
    return {
      started: this.started,
      attempts: this.attempts,
      succeeded: this.succeeded,
      exhausted: this.exhausted,
      bypassed: this.bypassed,
      successRate: this.started === 0 ? 0 : this.succeeded / this.started,
      totalLatencyMs: this.totalLatencyMs,
      averageLatencyMs: this.latencySamples === 0 ? 0 : this.totalLatencyMs / this.latencySamples,
      transitions,
    };
  }

  reset(): void {
    this.started = 0;
    this.attempts = 0;
    this.succeeded = 0;
    this.exhausted = 0;
    this.bypassed = 0;
    this.totalLatencyMs = 0;
    this.latencySamples = 0;
    this.transitions.clear();
  }
}
