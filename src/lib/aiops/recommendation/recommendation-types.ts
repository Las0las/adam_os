// IOS-019 — Cost Optimization Engine — the CostRecommendation specialization.
//
// IOS-019 is the canonical producer of CostRecommendation ONLY. It does NOT own the
// Recommendation hierarchy: the abstract `Recommendation` contract is taxonomy-level
// and shared (see recommendation-contract.ts), reused by every future specialization
// (SLA/routing/provider/capacity/policy), each owned by its own specification.
//
// The Cost Optimization Engine is PURELY ADVISORY: it consumes published model
// metadata (IOS-018), execution history, benchmark results, provider health, and
// evaluation results BY REFERENCE and produces immutable CostRecommendation objects.
// It never influences routing, authorizes execution targets, invokes providers, or
// mutates anything it consumes.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { Recommendation, RecommendationSubject } from "./recommendation-contract";

// Re-export the abstract taxonomy contract for convenience (it is a Shared
// Canonical Contract, not owned by IOS-019).
export type {
  Recommendation,
  RecommendationType,
  RecommendationPriority,
  RecommendationStatus,
  RecommendationSubject,
  EvidenceReference,
} from "./recommendation-contract";
export { recommendationKey } from "./recommendation-contract";

export type CostAction = "no_change" | "switch_model" | "reduce_usage" | "investigate";

/** The first CONCRETE specialization of Recommendation — a Canonical Object owned
 *  and produced solely by IOS-019 (immutable). It carries the shared base fields
 *  plus the cost-specific fields below. */
export interface CostRecommendation extends Recommendation {
  recommendationType: "cost";
  /** The model target this cost recommendation concerns. */
  subject: RecommendationSubject;
  /** Observed blended cost per 1M tokens for the subject, or null. */
  observedCostPerMTok: number | null;
  /** Published blended price per 1M tokens for the subject, or null. */
  pricedCostPerMTok: number | null;
  action: CostAction;
  /** A cheaper, no-worse alternative target (if any). */
  alternative: (RecommendationSubject & { pricedCostPerMTok: number | null }) | null;
  /** Projected savings vs. the subject, percent (0..100), or null. */
  projectedSavingsPct: number | null;
}

/** A single observed execution cost (assembled from execution history by the
 *  caller; consumed by reference). */
export interface CostObservation {
  provider: string;
  model: string;
  costUsd: number;
  totalTokens: number;
}

export type CostMode = "disabled" | "enabled";

export interface CostOptimizationPolicy {
  mode: CostMode;
  /** Minimum observations for a subject before it is considered. */
  minObservations: number;
  /** Minimum projected savings (percent) to recommend switching. */
  savingsThresholdPct: number;
  eligibleProviders: string[];
  eligibleWorkloads: string[];
}

export function defaultCostOptimizationPolicy(): CostOptimizationPolicy {
  return { mode: "disabled", minObservations: 1, savingsThresholdPct: 10, eligibleProviders: [], eligibleWorkloads: [] };
}

export class CostOptimizationPolicyStore {
  private policy: CostOptimizationPolicy;
  constructor(policy: CostOptimizationPolicy = defaultCostOptimizationPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): CostOptimizationPolicy {
    return this.policy;
  }
  configure(policy: CostOptimizationPolicy): void {
    this.policy = deepFreeze(policy);
  }
}
