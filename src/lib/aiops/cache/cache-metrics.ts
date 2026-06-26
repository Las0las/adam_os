// Prompt Cache Middleware (Milestone 7.0, deliverable #6) — Cache Metrics.
//
// A passive bus subscriber that folds cache events into running counters. It
// establishes the collection contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isCacheEvent } from "./cache-events";

export interface CacheMetricsSnapshot {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  /** hits / (hits + misses); 0 when no lookups have occurred. */
  hitRate: number;
  /** misses / (hits + misses); 0 when no lookups have occurred. */
  missRate: number;
  /** Live entry count as of the most recent store/eviction. */
  entryCount: number;
  /** Mean lookup time (ms) across hits + misses. */
  averageLookupMs: number;
}

export class CacheMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "cache-metrics";

  private hits = 0;
  private misses = 0;
  private stores = 0;
  private evictions = 0;
  private entryCount = 0;
  private lookupMsTotal = 0;

  onEvent(event: BusEvent): void {
    if (!isCacheEvent(event)) return;
    switch (event.type) {
      case "cache.hit":
        this.hits += 1;
        this.lookupMsTotal += event.lookupMs;
        break;
      case "cache.miss":
        this.misses += 1;
        this.lookupMsTotal += event.lookupMs;
        break;
      case "cache.store":
        this.stores += 1;
        this.entryCount = event.entryCount;
        break;
      case "cache.expired":
        this.evictions += 1;
        this.entryCount = event.entryCount;
        break;
    }
  }

  snapshot(): CacheMetricsSnapshot {
    const lookups = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      stores: this.stores,
      evictions: this.evictions,
      hitRate: lookups === 0 ? 0 : this.hits / lookups,
      missRate: lookups === 0 ? 0 : this.misses / lookups,
      entryCount: this.entryCount,
      averageLookupMs: lookups === 0 ? 0 : this.lookupMsTotal / lookups,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.stores = 0;
    this.evictions = 0;
    this.entryCount = 0;
    this.lookupMsTotal = 0;
  }
}
