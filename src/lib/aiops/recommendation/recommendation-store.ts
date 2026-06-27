// IOS-019 — Recommendation store.
//
// Holds immutable Recommendation objects (currently CostRecommendation). Read-only
// to consumers; the engine writes. In-memory only. The store is keyed by kind so
// future specializations coexist under one taxonomy without collision.

import type { CostRecommendation, Recommendation, RecommendationKind } from "./recommendation-types";

export class RecommendationStore {
  private readonly items: Recommendation[] = [];

  add(recommendation: Recommendation): void {
    this.items.push(recommendation);
  }

  byKind(kind: RecommendationKind): Recommendation[] {
    return this.items.filter((r) => r.kind === kind);
  }

  /** Convenience accessor for the cost specialization. */
  costRecommendations(): CostRecommendation[] {
    return this.items.filter((r): r is CostRecommendation => r.kind === "cost");
  }

  all(): Recommendation[] {
    return [...this.items];
  }

  reset(): void {
    this.items.length = 0;
  }
}
