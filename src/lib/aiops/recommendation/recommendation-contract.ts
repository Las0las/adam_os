// Recommendation — the ABSTRACT canonical contract (platform recommendation
// taxonomy).
//
// This base contract is taxonomy-level and SHARED: it is NOT owned by any single
// IOS specification. `Recommendation` is abstract — it is never produced directly;
// only concrete specializations are. Each concrete recommendation type is OWNED and
// produced by exactly one specification, while reusing this common contract:
//   - CostRecommendation       → IOS-019 Cost Optimization Engine (first concrete)
//   - SLARecommendation        → (future)
//   - RoutingRecommendation    → (future)
//   - ProviderRecommendation   → (future)
//   - CapacityRecommendation   → (future)
//   - PolicyRecommendation     → (future)
//
// This preserves ownership boundaries (one producer per specialization) under a
// single recommendation taxonomy.

/** The recommendation taxonomy kinds. One concrete type per kind, each owned by
 *  exactly one specification. */
export type RecommendationKind =
  | "cost"
  | "sla"
  | "routing"
  | "provider"
  | "capacity"
  | "policy";

/** The subject a recommendation is about (a model target). */
export interface RecommendationSubject {
  provider: string;
  model: string;
}

/** The ABSTRACT base contract every concrete recommendation extends. It is never
 *  produced directly; producing a recommendation is always done through a concrete
 *  specialization owned by a single specification. Recommendations are immutable
 *  and ALWAYS advisory. */
export interface Recommendation {
  recommendationId: string;
  kind: RecommendationKind;
  subject: RecommendationSubject;
  rationale: string;
  /** 0..1 confidence derived deterministically from available evidence. */
  confidence: number;
  createdAt: number;
  /** Recommendations never act; they advise. */
  advisory: true;
}

/** Stable identity for a subject within the taxonomy. */
export function recommendationKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}
