// IOS-012 — Fallback Orchestrator (per AS-001) — policy + contracts.
//
// Composes ENTIRELY through the AS-001 R9 / IOS-004 AroundInvoke contract and its
// ADR-0004 Execution Plan capability — no new execution seam. After the primary
// path (retry/circuit) fails with a transient/unavailable error, the orchestrator
// redirects the invocation to an ALTERNATE target SELECTED FROM the immutable
// Execution Plan that the routing layer authorized (`ctx.executionPlan`) —
// deterministically, in plan order. It never re-runs routing, mutates the
// RoutingDecision, or invents/authorizes targets; the fallback policy may only
// restrict/order among plan members. Behavior is governed by immutable
// FallbackPolicy objects; the default policy is DISABLED (no-op).

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

export type FallbackMode = "disabled" | "enabled";

export interface FallbackPolicy {
  mode: FallbackMode;
  /** OPTIONAL ordered restriction over the Execution Plan's alternates: when
   *  non-empty, only plan targets whose provider is listed are eligible, tried in
   *  this provider order. Empty = all plan alternates in plan (routing) order.
   *  This is execution POLICY over routing-authorized targets — it can never add
   *  a target that is not already in the plan. */
  fallbackProviders: string[];
  /** Maximum number of fallback attempts (alternate plan targets to try). */
  maxFallbackAttempts: number;
  /** Error kinds that make the primary failure fallback-eligible. */
  fallbackErrorClasses: ExecutionErrorKind[];
  /** Providers eligible for fallback (primary provider). Empty = all. */
  eligibleProviders: string[];
  /** Workloads eligible for fallback. Empty = all. */
  eligibleWorkloads: string[];
  /** When true, skip fallback entirely for this execution. */
  bypass: boolean;
}

/** Default policy: fallback OFF. Eligible error classes are transient provider
 *  faults only — not authentication, validation, or security. */
export function defaultFallbackPolicy(): FallbackPolicy {
  return {
    mode: "disabled",
    fallbackProviders: [],
    maxFallbackAttempts: 2,
    fallbackErrorClasses: ["timeout", "rate_limit", "provider_unavailable"],
    eligibleProviders: [],
    eligibleWorkloads: [],
    bypass: false,
  };
}

/** Holds the active fallback policy as an immutable snapshot. */
export class FallbackPolicyStore {
  private policy: FallbackPolicy;

  constructor(policy: FallbackPolicy = defaultFallbackPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): FallbackPolicy {
    return this.policy;
  }

  configure(policy: FallbackPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** Whether the policy permits fallback for this execution (provider/workload
 *  filters). Does NOT consider mode/bypass — the orchestrator checks those. */
export function fallbackEligible(policy: FallbackPolicy, ctx: InferenceExecutionContext): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(ctx.provider)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(ctx.workloadType)) return false;
  return true;
}

/** Chain position: the orchestrator composes through AroundInvoke BETWEEN the
 *  circuit breaker (2.4) and retry (2.5):
 *  security → circuit breaker → fallback orchestrator → retry → provider.
 *  So each fallback target gets its own retry budget, and a recovered fallback
 *  is seen as success by the outer circuit breaker. */
export const FALLBACK_PRIORITY = 2.45;
