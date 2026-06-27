// IOS-020 — SLA Management (per AS-001) — the SLARecommendation specialization.
//
// IOS-020 is the canonical producer of SLARecommendation — a CONCRETE Canonical
// Object specializing the SHARED abstract Recommendation contract (taxonomy v1.0,
// owned by no single spec). IOS-020 does NOT redefine the base contract.
//
// The SLA Management Engine is PURELY ADVISORY: it consumes published model
// metadata (IOS-018), execution history, provider health (IOS-013), evaluation
// results (IOS-017), benchmark results (IOS-014), and the abstract Recommendation
// contract BY REFERENCE, and produces immutable SLARecommendation objects. It never
// influences routing, authorizes execution, invokes providers, or mutates anything
// it consumes.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { Recommendation, RecommendationSubject } from "@/lib/aiops/recommendation/recommendation-contract";

// Re-export the shared taxonomy contract for convenience (NOT owned by IOS-020).
export type { Recommendation, RecommendationSubject } from "@/lib/aiops/recommendation/recommendation-contract";

/** The SLA objective evaluated for a subject. */
export interface SLAObjective {
  /** Minimum acceptable availability (0..1). */
  targetAvailability: number;
  /** Maximum acceptable mean latency (ms), or null to ignore. */
  maxLatencyMs: number | null;
  /** Maximum acceptable error rate (0..1), or null to ignore. */
  maxErrorRate: number | null;
}

export type SLAAction = "no_change" | "investigate" | "mitigate" | "escalate";

/** The CONCRETE SLA specialization — a Canonical Object owned/produced by IOS-020. */
export interface SLARecommendation extends Recommendation {
  recommendationType: "sla";
  subject: RecommendationSubject;
  objective: SLAObjective;
  observed: { availability: number; latencyMs: number; errorRate: number };
  breached: boolean;
  breachedDimensions: string[];
  action: SLAAction;
}

export type SLAMode = "disabled" | "enabled";

export interface SLAPolicy {
  mode: SLAMode;
  objective: SLAObjective;
  eligibleProviders: string[];
  eligibleWorkloads: string[];
}

export function defaultSLAPolicy(): SLAPolicy {
  return {
    mode: "disabled",
    objective: { targetAvailability: 0.99, maxLatencyMs: null, maxErrorRate: null },
    eligibleProviders: [],
    eligibleWorkloads: [],
  };
}

export class SLAPolicyStore {
  private policy: SLAPolicy;
  constructor(policy: SLAPolicy = defaultSLAPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): SLAPolicy {
    return this.policy;
  }
  configure(policy: SLAPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

export function slaEligible(policy: SLAPolicy, provider: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  return true;
}
