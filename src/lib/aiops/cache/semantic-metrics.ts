// IOS-009 — Semantic Cache — passive metrics.
//
// A bus subscriber that folds semantic.* events into running counters. Collection
// contract only — no dashboards, no persistence. (Per-store hit/miss rate for the
// "semantic" store is also available from the IOS-007 cache metrics via the
// `store` field; these metrics add similarity-specific signals.)

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isSemanticEvent } from "./semantic-events";

export interface SemanticMetricsSnapshot {
  hits: number;
  misses: number;
  stored: number;
  /** hits / (hits + misses); 0 when no lookups. */
  hitRate: number;
  /** Mean cosine similarity of hits. */
  averageHitSimilarity: number;
  /** Mean best-similarity of misses (how close near-misses were). */
  averageMissSimilarity: number;
}

export class SemanticCacheMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "semantic-metrics";

  private hits = 0;
  private misses = 0;
  private stored = 0;
  private hitSimTotal = 0;
  private missSimTotal = 0;

  onEvent(event: BusEvent): void {
    if (!isSemanticEvent(event)) return;
    switch (event.type) {
      case "semantic.hit":
        this.hits += 1;
        this.hitSimTotal += event.similarity;
        break;
      case "semantic.miss":
        this.misses += 1;
        this.missSimTotal += event.bestSimilarity;
        break;
      case "semantic.stored":
        this.stored += 1;
        break;
    }
  }

  snapshot(): SemanticMetricsSnapshot {
    const lookups = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      stored: this.stored,
      hitRate: lookups === 0 ? 0 : this.hits / lookups,
      averageHitSimilarity: this.hits === 0 ? 0 : this.hitSimTotal / this.hits,
      averageMissSimilarity: this.misses === 0 ? 0 : this.missSimTotal / this.misses,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.stored = 0;
    this.hitSimTotal = 0;
    this.missSimTotal = 0;
  }
}
