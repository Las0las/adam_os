// IOS-013 — Provider Health Manager (per AS-001) — types + policy.
//
// The Provider Health Manager is a PURELY OBSERVATIONAL subsystem: a subscriber
// on the Execution Event Bus (IOS-005) that folds observed execution outcomes
// into immutable ProviderHealthSnapshot records. It NEVER performs routing,
// invokes providers, authorizes targets, modifies the Execution Plan, retries, or
// triggers fallback. Health is observational; execution and routing remain
// authoritative. Behavior is governed by immutable HealthPolicy objects; the
// default policy is DISABLED (no-op until a tenant opts in).
//
// (Distinct from the legacy Milestone-5.0 `ProviderHealth` registry view in
// provider-registry-types.ts — this is the canonical IOS-013 health source.)

import { deepFreeze } from "@/lib/aiops/routing/routing-types";

/** Normalized provider health state. No adaptive or predictive states. */
export type HealthStatus = "healthy" | "degraded" | "unavailable" | "unknown";

/** Observed circuit state for a provider+model, or unknown if never observed. */
export type ObservedCircuitState = "closed" | "open" | "half_open" | "unknown";

/** An immutable snapshot of one provider+model's health. Frozen on publication. */
export interface ProviderHealthSnapshot {
  provider: string;
  model: string;
  status: HealthStatus;
  /** Successful executions / observed executions in the window (0..1). */
  availability: number;
  /** Mean latency over the observation window (ms). */
  latencyMs: number;
  /** Timeouts / observed executions in the window (0..1). */
  timeoutRate: number;
  /** Failures / observed executions in the window (0..1). */
  errorRate: number;
  /** Retry successes / (retry successes + exhaustions) observed (0..1). */
  retrySuccessRate: number;
  /** Last observed circuit state for this provider+model. */
  circuitState: ObservedCircuitState;
  /** Fallback activations / observed executions (0..1, may exceed via cumulative). */
  fallbackFrequency: number;
  /** Composite score (0..1); 0 when the circuit is observed open. */
  healthScore: number;
  /** When this snapshot was produced (epoch ms). */
  lastUpdated: number;
}

export type HealthMode = "disabled" | "enabled";

export interface HealthPolicy {
  mode: HealthMode;
  /** Number of recent execution outcomes considered (count-based window). */
  observationWindow: number;
  /** Availability below this (within the window) → at least Degraded. */
  degradedBelow: number;
  /** Availability below this → Unavailable. */
  unavailableBelow: number;
  /** Availability at/above this recovers a Degraded/Unavailable provider to Healthy. */
  recoverAbove: number;
  /** Providers eligible for health tracking (by registry id). Empty = all. */
  eligibleProviders: string[];
  /** Workloads eligible for health tracking. Empty = all. */
  eligibleWorkloads: string[];
}

/** Default policy: health tracking OFF (observational no-op until enabled). */
export function defaultHealthPolicy(): HealthPolicy {
  return {
    mode: "disabled",
    observationWindow: 20,
    degradedBelow: 0.85,
    unavailableBelow: 0.5,
    recoverAbove: 0.95,
    eligibleProviders: [],
    eligibleWorkloads: [],
  };
}

/** Holds the active health policy as an immutable snapshot. */
export class HealthPolicyStore {
  private policy: HealthPolicy;

  constructor(policy: HealthPolicy = defaultHealthPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): HealthPolicy {
    return this.policy;
  }

  configure(policy: HealthPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** The health identity: one record per provider + model. */
export function healthKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}

/** Whether the policy tracks health for this provider/workload. */
export function healthEligible(policy: HealthPolicy, provider: string, workloadType: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(workloadType)) return false;
  return true;
}
