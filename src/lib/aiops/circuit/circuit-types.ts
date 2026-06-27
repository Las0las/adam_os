// IOS-011 — Circuit Breaker (per AS-001) — policy + contracts.
//
// Composes ENTIRELY through the existing AS-001 R9 / IOS-004 AroundInvoke
// provider-invocation contract (ADR-0003) — no new execution seam. The breaker
// tracks failures per circuit (provider+model) and, once tripped, fast-fails
// subsequent calls without invoking the provider, until a cooldown elapses and a
// probe succeeds. Behavior is governed by immutable CircuitPolicy objects; the
// default policy is DISABLED, so installing it changes nothing until a tenant
// opts in.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

export type CircuitMode = "disabled" | "enabled";
export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitPolicy {
  mode: CircuitMode;
  /** Consecutive qualifying failures that trip a closed circuit to open. */
  failureThreshold: number;
  /** Time a circuit stays open before allowing a half-open probe (ms). */
  cooldownMs: number;
  /** Successful probes in half-open required to close the circuit. */
  successThreshold: number;
  /** Error kinds that count toward tripping (deterministic). */
  trippingErrorClasses: ExecutionErrorKind[];
  /** Providers eligible for breaking (by registry id). Empty = all. */
  eligibleProviders: string[];
  /** Workloads eligible for breaking. Empty = all. */
  eligibleWorkloads: string[];
  /** When true, skip the breaker entirely for this execution. */
  bypass: boolean;
}

/** Default policy: breaker OFF. Tripping classes are transient provider faults
 *  only — not authentication (a config fault), validation, or security. */
export function defaultCircuitPolicy(): CircuitPolicy {
  return {
    mode: "disabled",
    failureThreshold: 5,
    cooldownMs: 30_000,
    successThreshold: 1,
    trippingErrorClasses: ["timeout", "rate_limit", "provider_unavailable"],
    eligibleProviders: [],
    eligibleWorkloads: [],
    bypass: false,
  };
}

/** Holds the active circuit policy as an immutable snapshot. */
export class CircuitPolicyStore {
  private policy: CircuitPolicy;

  constructor(policy: CircuitPolicy = defaultCircuitPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): CircuitPolicy {
    return this.policy;
  }

  configure(policy: CircuitPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** The circuit identity: one breaker per provider + model (no cross-provider
 *  coupling). */
export function circuitKey(ctx: InferenceExecutionContext): string {
  return `${ctx.provider}|${ctx.model}`;
}

/** Whether the policy permits breaking this execution (provider/workload filters).
 *  Does NOT consider mode/bypass — the middleware checks those. */
export function circuitEligible(policy: CircuitPolicy, ctx: InferenceExecutionContext): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(ctx.provider)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(ctx.workloadType)) return false;
  return true;
}

/** Chain position: the breaker composes around the AroundInvoke contract
 *  OUTSIDE the retry middleware (priority 2.4 < retry 2.5), so an open circuit
 *  fast-fails immediately and does not consume retry attempts:
 *  security → circuit breaker → retry → provider. */
export const CIRCUIT_PRIORITY = 2.4;
