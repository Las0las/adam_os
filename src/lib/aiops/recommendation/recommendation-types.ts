// IOS-019 — Cost Optimization Engine (per AS-001) — the canonical Recommendation
// taxonomy + CostRecommendation, the first specialization.
//
// IOS-019 establishes the BASE Recommendation contract (a single platform-wide
// recommendation taxonomy) and becomes the canonical producer of CostRecommendation
// — the first specialization. It does NOT introduce a generic recommendation engine
// and does NOT implement the future specializations (SLARecommendation,
// RoutingRecommendation, ProviderRecommendation, CapacityRecommendation,
// PolicyRecommendation); each future specification owns only its own specialization
// while reusing this base contract.
//
// The Cost Optimization Engine is PURELY ADVISORY: it consumes published metadata
// (IOS-018), execution history, benchmark results, provider health, and evaluation
// results BY REFERENCE and produces immutable CostRecommendation objects. It never
// influences routing, authorizes execution targets, or mutates anything it consumes.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";

/** The recommendation taxonomy. IOS-019 produces only "cost"; the others are
 *  reserved for future specifications that own their own specialization. */
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

/** The BASE canonical Recommendation contract. Every specialization extends this
 *  and reuses it unchanged. Recommendations are immutable and ALWAYS advisory. */
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

export type CostAction = "no_change" | "switch_model" | "reduce_usage" | "investigate";

/** The first specialization: a cost recommendation (canonical, immutable). */
export interface CostRecommendation extends Recommendation {
  kind: "cost";
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

export function recommendationKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}
