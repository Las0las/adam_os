// IOS-013 — Provider Health Manager — passive metrics.
//
// A bus subscriber that folds provider_health.* events into running counters. No
// dashboards, no persistence beyond the ProviderHealth store. Degraded duration
// is accumulated from event timestamps (degraded/unavailable → recovered).

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isHealthEvent } from "./health-events";
import { healthKey } from "./health-types";

export interface HealthMetricsSnapshot {
  updates: number;
  /** Status transitions observed (degraded + unavailable + recovered). */
  transitions: number;
  degraded: number;
  unavailable: number;
  recovered: number;
  /** Accumulated time providers spent below Healthy (ms). */
  degradedDurationMs: number;
  /** Latest availability and latency per provider+model (uptime view). */
  byProvider: Record<string, { availability: number; latencyMs: number; status: string }>;
}

export class HealthMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "provider-health-metrics";

  private updates = 0;
  private degraded = 0;
  private unavailable = 0;
  private recovered = 0;
  private degradedDurationMs = 0;
  private readonly byProvider = new Map<string, { availability: number; latencyMs: number; status: string }>();
  /** Per-key timestamp at which the provider last entered a below-Healthy state. */
  private readonly degradedSince = new Map<string, number>();

  onEvent(event: BusEvent): void {
    if (!isHealthEvent(event)) return;
    const key = healthKey(event.health.provider, event.health.model);
    switch (event.type) {
      case "provider_health.updated":
        this.updates += 1;
        this.byProvider.set(key, {
          availability: event.health.availability,
          latencyMs: event.health.latencyMs,
          status: event.health.status,
        });
        break;
      case "provider_health.degraded":
        this.degraded += 1;
        if (!this.degradedSince.has(key)) this.degradedSince.set(key, event.timestamp);
        break;
      case "provider_health.unavailable":
        this.unavailable += 1;
        if (!this.degradedSince.has(key)) this.degradedSince.set(key, event.timestamp);
        break;
      case "provider_health.recovered": {
        this.recovered += 1;
        const since = this.degradedSince.get(key);
        if (since != null) {
          this.degradedDurationMs += Math.max(0, event.timestamp - since);
          this.degradedSince.delete(key);
        }
        break;
      }
    }
  }

  snapshot(): HealthMetricsSnapshot {
    const byProvider: Record<string, { availability: number; latencyMs: number; status: string }> = {};
    for (const [k, v] of this.byProvider) byProvider[k] = { ...v };
    return {
      updates: this.updates,
      transitions: this.degraded + this.unavailable + this.recovered,
      degraded: this.degraded,
      unavailable: this.unavailable,
      recovered: this.recovered,
      degradedDurationMs: this.degradedDurationMs,
      byProvider,
    };
  }

  reset(): void {
    this.updates = 0;
    this.degraded = 0;
    this.unavailable = 0;
    this.recovered = 0;
    this.degradedDurationMs = 0;
    this.byProvider.clear();
    this.degradedSince.clear();
  }
}
