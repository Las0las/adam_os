// Recommendation store — SHARED taxonomy infrastructure (not owned by IOS-019).
//
// Holds immutable Recommendation objects of any concrete specialization, keyed by
// kind so future specializations coexist under one taxonomy without collision.
// Read-only to consumers; each specialization's owning engine writes its own
// concrete recommendations (IOS-019 writes CostRecommendation). In-memory only.

import type { Recommendation, RecommendationType } from "./recommendation-contract";
import type { CostRecommendation } from "./recommendation-types";

export class RecommendationStore {
  private readonly items: Recommendation[] = [];

  add(recommendation: Recommendation): void {
    this.items.push(recommendation);
  }

  byType(type: RecommendationType): Recommendation[] {
    return this.items.filter((r) => r.recommendationType === type);
  }

  /** Convenience accessor for the cost specialization. */
  costRecommendations(): CostRecommendation[] {
    return this.items.filter((r): r is CostRecommendation => r.recommendationType === "cost");
  }

  all(): Recommendation[] {
    return [...this.items];
  }

  reset(): void {
    this.items.length = 0;
  }
}
