// Recommendation Taxonomy v1.0 — the abstract, SHARED canonical contract.
//
// `Recommendation` is a SHARED CANONICAL CONTRACT: a reusable object taxonomy that
// is NEVER directly produced and has NO canonical producer. It defines ONLY the
// common semantics shared by all recommendations — no domain-specific fields.
//
// Concrete recommendation types extend it; each CONCRETE type is a Canonical Object
// with exactly ONE canonical producer:
//   Recommendation (abstract, shared) →
//     CostRecommendation        → IOS-019  (implemented)
//     SLARecommendation         → IOS-020  (reserved)
//     ProviderRecommendation    → (reserved)
//     CapacityRecommendation    → (reserved)
//     PolicyRecommendation      → (reserved)
//     RoutingRecommendation     → (reserved)
//     SchedulingRecommendation  → (reserved)
//     OptimizationRecommendation→ (reserved)
//
// No future specification SHALL redefine this base contract. Taxonomy v1.0 is FROZEN.

/** The concrete recommendation kinds in the taxonomy. */
export type RecommendationType =
  | "cost"
  | "sla"
  | "provider"
  | "capacity"
  | "policy"
  | "routing"
  | "scheduling"
  | "optimization";

export type RecommendationPriority = "low" | "medium" | "high" | "critical";

/** Lifecycle status of a recommendation (advisory throughout). */
export type RecommendationStatus = "proposed" | "acknowledged" | "applied" | "dismissed" | "expired";

/** A reference (never an embedded copy) to a canonical object that is evidence for
 *  a recommendation — e.g. a ModelCapability key, a ProviderHealthSnapshot key. */
export interface EvidenceReference {
  /** The kind of canonical object referenced (e.g. "modelCapability", "benchmark",
   *  "providerHealth", "evaluation", "executionHistory"). */
  kind: string;
  /** A stable identifier/key for the referenced object. */
  ref: string;
}

/** The subject a recommendation concerns. Provided by concrete specializations
 *  that target a model (NOT part of the abstract base's required semantics). */
export interface RecommendationSubject {
  provider: string;
  model: string;
}

/** The ABSTRACT base contract. Common semantics only — no domain-specific fields.
 *  Never produced directly; only concrete specializations are produced. */
export interface Recommendation {
  recommendationId: string;
  recommendationType: RecommendationType;
  priority: RecommendationPriority;
  /** 0..1 confidence derived deterministically from available evidence. */
  confidence: number;
  rationale: string;
  /** References to the canonical objects that justify the recommendation. */
  evidenceReferences: EvidenceReference[];
  /** Normalized 0..1 magnitude of the recommendation's impact, or null. */
  estimatedImpact: number | null;
  /** Estimated cost dimension (e.g. current/blended cost rate), or null. */
  estimatedCost: number | null;
  /** Estimated benefit dimension (e.g. projected savings), or null. */
  estimatedBenefit: number | null;
  createdAt: number;
  /** The specification id of the producing engine (e.g. "IOS-019"). */
  producerSpecification: string;
  recommendationStatus: RecommendationStatus;
}

/** Stable identity for a subject within the taxonomy. */
export function recommendationKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}
