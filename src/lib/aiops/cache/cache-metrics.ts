// Unified Cache Platform (Milestone 7.5, deliverable #8) — Cache Metrics.
//
// A passive bus subscriber that folds cache events into running counters. The
// Milestone 7.0 aggregate fields are retained; 7.5 adds per-store breakdowns and
// lookup/store latency. Collection contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isCacheEvent } from "./cache-events";

export interface PerStoreCacheMetrics {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  entryCount: number;
  capacity: number;
  hitRate: number;
  missRate: number;
  /** entryCount / capacity (0 when capacity is unbounded/unknown). */
  utilization: number;
  /** evictions / stores (0 when nothing stored). */
  evictionRate: number;
}

export interface CacheMetricsSnapshot {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  hitRate: number;
  missRate: number;
  entryCount: number;
  /** Mean per-store lookup time (ms) across hits + misses (Milestone 7.0). */
  averageLookupMs: number;
  /** Mean whole-lookup latency (ms) from lookup-completed events (7.5). */
  lookupLatencyMs: number;
  /** Mean store write latency (ms) from store events (7.5). */
  storeLatencyMs: number;
  /** Per-store breakdown (7.5). */
  perStore: Record<string, PerStoreCacheMetrics>;
}

interface StoreCounters {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  entryCount: number;
  capacity: number;
}

function emptyCounters(): StoreCounters {
  return { hits: 0, misses: 0, stores: 0, evictions: 0, entryCount: 0, capacity: 0 };
}

export class CacheMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "cache-metrics";

  private hits = 0;
  private misses = 0;
  private stores = 0;
  private evictions = 0;
  private lookupMsTotal = 0; // per-store hit/miss timings (7.0 averageLookupMs)
  private lookupLatencyTotal = 0;
  private lookupCompletedCount = 0;
  private storeMsTotal = 0;
  private storeCount = 0;
  private readonly perStore = new Map<string, StoreCounters>();

  private store(name: string): StoreCounters {
    let c = this.perStore.get(name);
    if (!c) {
      c = emptyCounters();
      this.perStore.set(name, c);
    }
    return c;
  }

  onEvent(event: BusEvent): void {
    if (!isCacheEvent(event)) return;
    switch (event.type) {
      case "cache.hit": {
        this.hits += 1;
        this.lookupMsTotal += event.lookupMs;
        this.store(event.store).hits += 1;
        break;
      }
      case "cache.miss": {
        this.misses += 1;
        this.lookupMsTotal += event.lookupMs;
        this.store(event.store).misses += 1;
        break;
      }
      case "cache.store": {
        this.stores += 1;
        this.storeMsTotal += event.storeMs;
        this.storeCount += 1;
        const c = this.store(event.store);
        c.stores += 1;
        c.entryCount = event.entryCount;
        c.capacity = event.capacity;
        break;
      }
      case "cache.expired": {
        this.evictions += 1;
        const c = this.store(event.store);
        c.evictions += 1;
        c.entryCount = event.entryCount;
        c.capacity = event.capacity;
        break;
      }
      case "cache.lookup_completed": {
        this.lookupLatencyTotal += event.lookupMs;
        this.lookupCompletedCount += 1;
        break;
      }
      // cache.lookup_started / cache.store_selected carry no counters.
    }
  }

  snapshot(): CacheMetricsSnapshot {
    const lookups = this.hits + this.misses;
    const perStore: Record<string, PerStoreCacheMetrics> = {};
    let entryCount = 0;
    for (const [name, c] of this.perStore) {
      const storeLookups = c.hits + c.misses;
      const finiteCap = Number.isFinite(c.capacity) && c.capacity > 0;
      perStore[name] = {
        hits: c.hits,
        misses: c.misses,
        stores: c.stores,
        evictions: c.evictions,
        entryCount: c.entryCount,
        capacity: c.capacity,
        hitRate: storeLookups === 0 ? 0 : c.hits / storeLookups,
        missRate: storeLookups === 0 ? 0 : c.misses / storeLookups,
        utilization: finiteCap ? c.entryCount / c.capacity : 0,
        evictionRate: c.stores === 0 ? 0 : c.evictions / c.stores,
      };
      entryCount += c.entryCount;
    }
    return {
      hits: this.hits,
      misses: this.misses,
      stores: this.stores,
      evictions: this.evictions,
      hitRate: lookups === 0 ? 0 : this.hits / lookups,
      missRate: lookups === 0 ? 0 : this.misses / lookups,
      entryCount,
      averageLookupMs: lookups === 0 ? 0 : this.lookupMsTotal / lookups,
      lookupLatencyMs: this.lookupCompletedCount === 0 ? 0 : this.lookupLatencyTotal / this.lookupCompletedCount,
      storeLatencyMs: this.storeCount === 0 ? 0 : this.storeMsTotal / this.storeCount,
      perStore,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.stores = 0;
    this.evictions = 0;
    this.lookupMsTotal = 0;
    this.lookupLatencyTotal = 0;
    this.lookupCompletedCount = 0;
    this.storeMsTotal = 0;
    this.storeCount = 0;
    this.perStore.clear();
  }
}
